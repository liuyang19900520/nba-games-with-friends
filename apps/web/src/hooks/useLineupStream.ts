'use client';
import { useCallback } from 'react';
import { useAiStream } from './useAiStream';
import { getTokyoDate } from '@/lib/utils/game-date';
import type { LineupPlayer, ProgressStep } from '@/lib/ai/contracts';

export type { LineupPlayer };
export type LineupProgressStep = ProgressStep;
export type LineupStreamStatus = 'idle' | 'streaming' | 'complete' | 'error';
export function useLineupStream() {
  const stream = useAiStream<{ players: LineupPlayer[]; game_date: string; explanation: string; mode: 'demo' | 'llm' }>();
  const { start } = stream;
  const startGeneration = useCallback((gameDate?: string) => {
    start('/api/lineup/generate', { game_date: gameDate || getTokyoDate() });
  }, [start]);
  return {
    ...stream, startGeneration,
    players: stream.result?.players || [],
    gameDate: stream.result?.game_date || null,
    explanation: stream.result?.explanation || '',
    mode: stream.result?.mode,
  };
}
