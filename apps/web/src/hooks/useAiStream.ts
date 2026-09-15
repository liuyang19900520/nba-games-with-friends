'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { readEventStream, StreamError } from '@/lib/http/sse';
import type { ProgressStep } from '@/lib/ai/contracts';

type Step = ProgressStep & { phase: 'planning' | 'executing' | 'complete' };
export function useAiStream<T>() {
  const [status, setStatus] = useState<'idle' | 'streaming' | 'complete' | 'error'>('idle');
  const [steps, setSteps] = useState<Step[]>([]);
  const [result, setResult] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const pending = useRef(false);
  const lastRequest = useRef<{ payload: string; id: string } | null>(null);

  useEffect(() => () => { controllerRef.current?.abort(); controllerRef.current = null; }, []);
  const reset = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    pending.current = false;
    setStatus('idle'); setSteps([]); setResult(null); setError(null);
  }, []);

  const start = useCallback((endpoint: string, input: Record<string, unknown>) => {
    if (pending.current) return;
    pending.current = true;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setStatus('streaming'); setSteps([]); setResult(null); setError(null);
    const payload = endpoint + JSON.stringify(input);
    // A transport failure retains the ID; retrying the same payload replays a persisted result.
    const id = lastRequest.current?.payload === payload ? lastRequest.current.id : crypto.randomUUID();
    lastRequest.current = { payload, id };
    const active = () => controllerRef.current === controller && !controller.signal.aborted;
    void (async () => {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Idempotency-Key': id },
          body: JSON.stringify(input), signal: controller.signal,
        });
        await readEventStream(response, ({ event, data }) => {
          if (!active()) return;
          if (event === 'result') setResult(data as T);
          else if (['progress', 'plan', 'execute'].includes(event)) setSteps(previous => [...previous, {
            step: Number(data.step), title: String(data.title || ''), detail: String(data.detail || ''),
            phase: event === 'plan' ? 'planning' : 'executing',
          }]);
        });
        if (active()) {
          setStatus('complete');
          lastRequest.current = null;
        }
      } catch (e) {
        if (!active()) return;
        if (e instanceof StreamError && e.code && !['STREAM_INTERRUPTED', 'REQUEST_PENDING'].includes(e.code)) lastRequest.current = null;
        setError(e instanceof Error ? e.message : 'Connection failed.');
        setStatus('error');
      } finally {
        if (active()) pending.current = false;
      }
    })();
  }, []);
  return { status, steps, result, error, start, reset };
}
