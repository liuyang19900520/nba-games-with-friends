'use server';

import { getRecentGames } from '@/lib/db/games';
import type { GameResult } from '@/types';
import { gameDateSchema } from '@/lib/ai/contracts';

/**
 * Server Action to fetch recent games for a specific date
 */
export async function fetchGamesByDate(date: string): Promise<GameResult[]> {
  if (!gameDateSchema.safeParse(date).success) return [];
  try {
    const games = await getRecentGames(10, date);
    return games;
  } catch (error) {
    console.error('[fetchGamesByDate] Error:', error);
    return [];
  }
}

/**
 * Prediction result from the AI Agent
 */
export type PredictionResultData = import('@/lib/ai/contracts').PredictionOutput;

/**
 * A single streaming step from the AI Agent
 */
export interface PredictionStep {
  step: number;
  phase: 'planning' | 'executing' | 'replanning' | 'concluding' | 'complete';
  title: string;
  detail: string | string[];
}
