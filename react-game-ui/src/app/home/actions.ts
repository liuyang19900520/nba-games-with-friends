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
  } catch (error) {
    console.error('[fetchGamesByDate] Error:', error);
    return [];
  }
}
