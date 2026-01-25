'use client';

import { getTokyoDate } from '@/lib/utils/timezone';

/**
 * Hook to get the game date
 * Always returns today's date in Tokyo timezone
 */
export function useGameDate() {
  const gameDate = getTokyoDate();

  const setGameDate = (_date: string) => {
    // No-op: Simulated date feature removed
    console.warn('setGameDate is deprecated. System uses real Tokyo date.');
  };

  const resetToToday = () => {
    // No-op
  };

  return {
    gameDate,
    setGameDate,
    resetToToday,
    isCustomDate: false,
  };
}
