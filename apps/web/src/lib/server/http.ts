import 'server-only';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/auth/supabase';
import { AppError } from './errors';

export function requireSameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  const expected = new URL(request.url).origin;
  if (origin && origin !== expected) throw new AppError('Invalid request origin.', 'INVALID_ORIGIN', 403);
}

export async function readJson(request: Request): Promise<unknown> {
  requireSameOrigin(request);
  if (!request.headers.get('content-type')?.includes('application/json')) {
    throw new AppError('JSON body required.', 'VALIDATION_ERROR', 415);
  }
  if (Number(request.headers.get('content-length') || 0) > 8192) throw new AppError('Request too large.', 'VALIDATION_ERROR', 413);
  const text = await request.text();
  if (new TextEncoder().encode(text).length > 8192) throw new AppError('Request too large.', 'VALIDATION_ERROR', 413);
  try { return JSON.parse(text); } catch { throw new AppError('Invalid JSON.', 'VALIDATION_ERROR'); }
}

export async function requireUser() {
  const client = await createClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) throw new AppError('Please log in to continue.', 'AUTH_REQUIRED', 401);
  return user;
}

export function errorResponse(error: unknown) {
  if (error instanceof AppError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  console.error('[web-api]', { type: error instanceof Error ? error.name : 'UnknownError' });
  return NextResponse.json({ error: 'The request could not be completed. Please try again.', code: 'INTERNAL_ERROR' }, { status: 500 });
}
