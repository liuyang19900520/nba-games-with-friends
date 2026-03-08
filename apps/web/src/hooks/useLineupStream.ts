'use client';

import { useState, useCallback, useRef } from 'react';

export type LineupStreamStatus = 'idle' | 'streaming' | 'complete' | 'error';

export interface LineupPlayer {
    player_id: string;
    player_name: string;
    position: string;
    headshot_url: string;
    team_name: string;
    team_code: string;
    team_logo_url: string;
    pts: number;
    reb: number;
    ast: number;
    fantasy_avg: number;
}

export interface LineupProgressStep {
    step: number;
    title: string;
    detail: string;
}

interface UseLineupStreamReturn {
    status: LineupStreamStatus;
    steps: LineupProgressStep[];
    players: LineupPlayer[];
    gameDate: string | null;
    error: string | null;
    startGeneration: (gameDate?: string) => void;
    reset: () => void;
}

/**
 * Hook that connects to the SSE lineup generation endpoint
 * and progressively collects progress steps + final result.
 */
export function useLineupStream(): UseLineupStreamReturn {
    const [status, setStatus] = useState<LineupStreamStatus>('idle');
    const [steps, setSteps] = useState<LineupProgressStep[]>([]);
    const [players, setPlayers] = useState<LineupPlayer[]>([]);
    const [gameDate, setGameDate] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const abortRef = useRef<AbortController | null>(null);

    const reset = useCallback(() => {
        if (abortRef.current) {
            abortRef.current.abort();
            abortRef.current = null;
        }
        setStatus('idle');
        setSteps([]);
        setPlayers([]);
        setGameDate(null);
        setError(null);
    }, []);

    const startGeneration = useCallback((requestGameDate?: string) => {
        // Reset previous state
        setStatus('streaming');
        setSteps([]);
        setPlayers([]);
        setGameDate(null);
        setError(null);

        // Abort any existing request
        if (abortRef.current) {
            abortRef.current.abort();
        }
        const controller = new AbortController();
        abortRef.current = controller;

        fetch('/api/lineup/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                game_date: requestGameDate || null,
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
                    buffer = lines.pop() || '';

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
                                    setSteps((prev) => [
                                        ...prev,
                                        { step: data.step, title: data.title, detail: '' },
                                    ]);
                                    setPlayers(data.players || []);
                                    setGameDate(data.game_date || null);
                                    setStatus('complete');
                                } else if (currentEventType === 'done') {
                                    // Stream ended
                                    setStatus((prev) => (prev === 'complete' ? 'complete' : 'complete'));
                                } else if (currentEventType === 'progress') {
                                    setSteps((prev) => [
                                        ...prev,
                                        {
                                            step: data.step,
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
                if (err.name === 'AbortError') return;
                console.error('[useLineupStream] Error:', err);
                setError(err.message || 'Connection failed');
                setStatus('error');
            });
    }, []);

    return { status, steps, players, gameDate, error, startGeneration, reset };
}
