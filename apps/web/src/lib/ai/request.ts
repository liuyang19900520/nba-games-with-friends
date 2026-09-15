import 'server-only';
import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { createServerClient } from '@/lib/db/supabase-server';
import { getAiMode, type AiMode } from '@/lib/server/config';
import { AppError } from '@/lib/server/errors';
import { readJson, requireUser, errorResponse } from '@/lib/server/http';
import { creditRpc } from '@/lib/server/credits';
import type { Progress } from './contracts';

interface Task<T> {
  kind: 'prediction' | 'lineup';
  schema: z.ZodType<T>;
  run: (db: SupabaseClient, input: T, mode: AiMode, signal: AbortSignal, progress: Progress) => Promise<Record<string, unknown>>;
}

export async function handleAiRequest<T>(request: Request, task: Task<T>) {
  try {
    const parsed = task.schema.safeParse(await readJson(request));
    const id = z.uuid().safeParse(request.headers.get('Idempotency-Key'));
    if (!parsed.success || !id.success) throw new AppError('A valid date, input and request ID are required.', 'VALIDATION_ERROR');
    const user = await requireUser();
    const mode = getAiMode();
    // This deadline leaves time for final database settlement before the 60-second host budget.
    const deadline = AbortSignal.timeout(45_000);
    const db = createServerClient(deadline);
    const hash = createHash('sha256').update(JSON.stringify({ version: 1, mode, input: parsed.data })).digest('hex');
    const reservation = await creditRpc(db, 'web_reserve_ai_credit', {
      p_user_id: user.id, p_request_id: id.data, p_kind: task.kind, p_input_hash: hash, p_mode: mode,
    });
    if (reservation.code) {
      const messages: Record<string, string> = {
        NO_CREDITS: 'No credits remaining. Top up demo credits to continue.',
        RATE_LIMITED: 'Today’s generation limit has been reached. Please try again tomorrow.',
        REQUEST_CONFLICT: 'This request ID belongs to a different request.',
        REQUEST_FAILED: 'This request did not finish. Start a new request to try again.',
        REQUEST_PENDING: 'This request is already running. Please wait before trying again.',
      };
      throw new AppError(messages[reservation.code] || 'Unable to start this request.', reservation.code,
        reservation.code === 'NO_CREDITS' ? 403 : reservation.code === 'RATE_LIMITED' ? 429 : 409);
    }

    const encoder = new TextEncoder();
    let connected = true;
    const stream = new ReadableStream({
      async start(controller) {
        const emit = (event: string, data: Record<string, unknown>) => {
          if (!connected) return;
          try { controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)); }
          catch { connected = false; }
        };
        // Persist completed results even if the browser disconnects. Retrying the same ID replays them.
        try {
          const result = reservation.state === 'succeeded' && reservation.result
            ? reservation.result
            : await task.run(db, parsed.data, mode, deadline, step => emit(task.kind === 'lineup' ? 'progress' : 'execute', { ...step, phase: 'executing' }));
          let balance = reservation.balance;
          if (reservation.state !== 'succeeded') {
            const settled = await creditRpc(createServerClient(), 'web_complete_ai_request', {
              p_user_id: user.id, p_request_id: id.data, p_result: result,
            });
            if (settled.state !== 'succeeded') throw new AppError('The request expired. Please try again.', 'REQUEST_FAILED', 409);
            balance = settled.balance;
          }
          emit('result', { ...result, step: 5, title: 'Complete', credits_remaining: balance, request_id: id.data });
          emit('done', {});
        } catch (error) {
          let refunded = false;
          try {
            const settled = await creditRpc(createServerClient(), 'web_fail_ai_request', { p_user_id: user.id, p_request_id: id.data });
            refunded = settled.state === 'failed';
          } catch { /* The next request recovers expired reservations if this settlement was interrupted. */ }
          emit('error', {
            message: refunded ? 'The request failed. Your credit has been restored.' : 'The request was interrupted. Check your balance before retrying.',
            code: error instanceof AppError ? error.code : 'GENERATION_FAILED',
          });
          console.error('[ai-request]', { id: id.data, kind: task.kind, type: error instanceof Error ? error.name : 'UnknownError' });
        } finally {
          if (connected) { connected = false; controller.close(); }
        }
      },
      cancel() { connected = false; },
    });
    return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
  } catch (error) { return errorResponse(error); }
}
