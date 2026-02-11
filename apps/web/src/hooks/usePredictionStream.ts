'use client';

import { useState, useCallback, useRef } from 'react';
import type { PredictionResultData, PredictionStep } from '@/app/home/actions';

export type PredictionStatus = 'idle' | 'streaming' | 'complete' | 'error';

interface UsePredictionStreamReturn {
    status: PredictionStatus;
    steps: PredictionStep[];
    result: PredictionResultData | null;
    error: string | null;
    startPrediction: (homeTeam: string, awayTeam: string, gameDate: string) => void;
    reset: () => void;
}

/**
 * Hook that connects to the SSE streaming predict endpoint
 * and progressively collects AI agent steps + final result.
 */
export function usePredictionStream(): UsePredictionStreamReturn {
    const [status, setStatus] = useState<PredictionStatus>('idle');
    const [steps, setSteps] = useState<PredictionStep[]>([]);
    const [result, setResult] = useState<PredictionResultData | null>(null);
    const [error, setError] = useState<string | null>(null);
    const abortRef = useRef<AbortController | null>(null);

    const reset = useCallback(() => {
        if (abortRef.current) {
            abortRef.current.abort();
            abortRef.current = null;
        }
        setStatus('idle');
        setSteps([]);
        setResult(null);
        setError(null);
    }, []);

    const startPrediction = useCallback((homeTeam: string, awayTeam: string, gameDate: string) => {
        // Reset previous state
        setStatus('streaming');
        setSteps([]);
        setResult(null);
        setError(null);

        // Abort any existing request
        if (abortRef.current) {
            abortRef.current.abort();
        }
        const controller = new AbortController();
        abortRef.current = controller;

        // Start SSE fetch
        fetch('/api/predict', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                home_team: homeTeam,
                away_team: awayTeam,
                game_date: gameDate,
            }),
            signal: controller.signal,
        })
            .then(async (response) => {
                if (!response.ok) {
                    const errData = await response.json().catch(() => ({}));
                    throw new Error(errData.error || `Server error (${response.status})`);
                }

                const reader = response.body?.getReader();
                if (!reader) throw new Error('No response stream');

                const decoder = new TextDecoder();
                let buffer = '';

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });

                    // Parse SSE lines
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || ''; // Keep incomplete line in buffer

                    let currentEventType = '';
                    for (const line of lines) {
                        if (line.startsWith('event: ')) {
                            currentEventType = line.slice(7).trim();
                        } else if (line.startsWith('data: ')) {
                            const dataStr = line.slice(6);
                            try {
                                const data = JSON.parse(dataStr);

                                if (currentEventType === 'error') {
                                    setError(data.message || 'Unknown error');
                                    setStatus('error');
                                    return;
                                }

                                if (currentEventType === 'result') {
                                    // Final prediction
                                    setSteps((prev) => [
                                        ...prev,
                                        { step: data.step, phase: 'complete', title: data.title, detail: '' },
                                    ]);
                                    setResult(data.prediction);
                                    setStatus('complete');
                                } else if (currentEventType === 'done') {
                                    // Stream ended
                                    setStatus((prev) => prev === 'complete' ? 'complete' : 'complete');
                                } else if (['plan', 'execute', 'replan'].includes(currentEventType)) {
                                    setSteps((prev) => [
                                        ...prev,
                                        {
                                            step: data.step,
                                            phase: data.phase,
                                            title: data.title,
                                            detail: data.detail,
                                        },
                                    ]);
                                }
                            } catch {
                                // Skip malformed JSON
                            }
                            currentEventType = '';
                        }
                    }
                }
            })
            .catch((err) => {
                if (err.name === 'AbortError') return; // Intentional abort
                console.error('[usePredictionStream] Error:', err);
                setError(err.message || 'Connection failed');
                setStatus('error');
            });
    }, []);

    return { status, steps, result, error, startPrediction, reset };
}
