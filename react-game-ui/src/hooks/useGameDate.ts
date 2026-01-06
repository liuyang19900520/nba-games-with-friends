'use client';

import { useState, useEffect } from 'react';

const GAME_DATE_STORAGE_KEY = 'nba-fantasy-game-date';
const GAME_DATE_COOKIE_KEY = 'nba-fantasy-game-date';

/**
 * Set cookie helper
 */
function setCookie(name: string, value: string, days: number = 365) {
  if (typeof document === 'undefined') return;
  const expires = new Date();
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/`;
}

/**
 * Get cookie helper
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
 * Hook to get and set the configured game date
 * Falls back to today's date if not configured
 * Also syncs with cookie for server-side access
 */
export function useGameDate() {
  const [gameDate, setGameDateState] = useState<string>(() => {
    if (typeof window === 'undefined') {
      return new Date().toISOString().split('T')[0];
    }
    // Check cookie first (for server-side sync), then localStorage
    const cookieDate = getCookie(GAME_DATE_COOKIE_KEY);
    const stored = cookieDate || localStorage.getItem(GAME_DATE_STORAGE_KEY);
    return stored || new Date().toISOString().split('T')[0];
  });

  useEffect(() => {
    // Sync with cookie and localStorage
    if (typeof window !== 'undefined') {
      const cookieDate = getCookie(GAME_DATE_COOKIE_KEY);
      const stored = cookieDate || localStorage.getItem(GAME_DATE_STORAGE_KEY);
      if (stored) {
        setGameDateState(stored);
        // Ensure both are in sync
        if (cookieDate !== stored) {
          setCookie(GAME_DATE_COOKIE_KEY, stored);
        }
        if (localStorage.getItem(GAME_DATE_STORAGE_KEY) !== stored) {
          localStorage.setItem(GAME_DATE_STORAGE_KEY, stored);
        }
      }
    }
  }, []);

  const setGameDate = (date: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(GAME_DATE_STORAGE_KEY, date);
      setCookie(GAME_DATE_COOKIE_KEY, date);
      setGameDateState(date);
    }
  };

  const resetToToday = () => {
    const today = new Date().toISOString().split('T')[0];
    setGameDate(today);
  };

  return {
    gameDate,
    setGameDate,
    resetToToday,
    isCustomDate: gameDate !== new Date().toISOString().split('T')[0],
  };
}
