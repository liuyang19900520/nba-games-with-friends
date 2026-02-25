'use server';

import { getRecentGames } from '@/lib/db/games';
import type { GameResult } from '@/types';

/**
 * Server Action to fetch recent games for a specific date
 */
export async function fetchGamesByDate(date: string): Promise<GameResult[]> {
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
export interface PredictionResultData {
  winner: string;
  confidence: number;
  key_factors: string[];
  detailed_analysis: string;
}

/**
 * A single streaming step from the AI Agent
 */
export interface PredictionStep {
  step: number;
  phase: 'planning' | 'executing' | 'replanning' | 'concluding' | 'complete';
  title: string;
  detail: string | string[];
}
