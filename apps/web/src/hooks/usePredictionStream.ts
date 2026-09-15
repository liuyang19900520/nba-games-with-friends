'use client';
import { useCallback } from 'react';
import { useAiStream } from './useAiStream';
import type { PredictionOutput } from '@/lib/ai/contracts';

export type PredictionStatus = 'idle' | 'streaming' | 'complete' | 'error';
export function usePredictionStream() {
  const stream = useAiStream<{ prediction: PredictionOutput }>();
  const { start } = stream;
  const startPrediction = useCallback((homeTeam: string, awayTeam: string, gameDate: string) => {
    start('/api/predict', { home_team: homeTeam, away_team: awayTeam, game_date: gameDate });
  }, [start]);
  return { ...stream, startPrediction, result: stream.result?.prediction || null };
}
