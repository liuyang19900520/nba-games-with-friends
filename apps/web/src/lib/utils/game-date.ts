import { cookies } from 'next/headers';
import { getTokyoDate, formatTokyoDate, isTodayTokyo } from './timezone';

const GAME_DATE_COOKIE_KEY = 'nba-fantasy-game-date';

/**
 * Utility functions for game date management
 * 
 * These functions work on both client and server side.
 * On server side, they read from cookies (set by client).
 * On client side, they check localStorage and cookie.
 * All dates are in Tokyo timezone (UTC+9).
 */

/**
 * Get the game date to use for data fetching (Server-side)
 * Returns date in Tokyo timezone
 * 
 * Priority:
 * 1. Cookie (set by client)
 * 2. Environment variable NEXT_PUBLIC_GAME_DATE (if set)
 * 3. Fallback: Today's date in Tokyo timezone
 */
export async function getGameDate(): Promise<string> {
  // Server side: check cookie first
  if (typeof window === 'undefined') {
    try {
      const cookieStore = await cookies();
      const cookieDate = cookieStore.get(GAME_DATE_COOKIE_KEY)?.value;
      if (cookieDate) {
        return cookieDate;
      }
    } catch {
      // Cookie access might fail in some contexts, continue to fallback
    }

    // Check environment variable
    const envDate = process.env.NEXT_PUBLIC_GAME_DATE;
    if (envDate) {
      return envDate;
    }

    // Fallback to today in Tokyo timezone
    return getTokyoDate();
  }

  // Client side: check cookie first (for consistency), then localStorage
  const cookieDate = getCookie(GAME_DATE_COOKIE_KEY);
  if (cookieDate) {
    return cookieDate;
  }

  const stored = localStorage.getItem('nba-fantasy-game-date');
  if (stored) {
    return stored;
  }

  // Fallback to today in Tokyo timezone
  return getTokyoDate();
}

/**
 * Get cookie helper (client-side only)
 */
function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const nameEQ = name + '=';
  const ca = document.cookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
  }
  return null;
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
