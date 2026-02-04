'use server';

import { getRecentGames } from '@/lib/db/games';
import type { GameResult } from '@/types';

/**
 * Server Action to fetch recent games for a specific date
 * Can be called from client components
 */
export async function fetchGamesByDate(date: string): Promise<GameResult[]> {
  try {
    const games = await getRecentGames(10, date);
    return games;
    // Existing export...
  } catch (error) {
    console.error('[fetchGamesByDate] Error:', error);
    return [];
  }
}

/**
 * Server Action to trigger AI prediction for a game
 * Simulates calling an AI Agent
 */
export async function predictGameOutcome(gameId: string): Promise<{ success: boolean; message: string }> {
  // Simulate network delay for AI processing
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // In a real implementation, this would call an external AI service or internal Agent
  console.log(`[predictGameOutcome] Predicting outcome for game: ${gameId}`);

  return {
    success: true,
    message: "Prediction request sent to AI Agent. You will receive a notification shortly."
  };
}
