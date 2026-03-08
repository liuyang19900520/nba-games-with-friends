import { formatTokyoDate, isTodayTokyo, getTomorrowTokyoDate } from './timezone';

/**
 * Utility functions for game date management
 * 
 * Always uses Tokyo timezone (UTC+9).
 * Simulated date feature has been removed.
 */

/**
 * Get the game date to use for data fetching (Server-side)
 * Returns tomorrow's date in Tokyo timezone by default
 */
export async function getGameDate(): Promise<string> {
  return getTomorrowTokyoDate();
}

/**
 * Format date for display (in Tokyo timezone)
 */
export function formatGameDate(dateStr: string): string {
  return formatTokyoDate(dateStr, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Check if a date is today (in Tokyo timezone)
 */
export function isToday(dateStr: string): boolean {
  return isTodayTokyo(dateStr);
}
