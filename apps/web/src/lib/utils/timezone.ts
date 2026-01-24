/**
 * Tokyo timezone utilities
 * All date/time operations should use Tokyo timezone (Asia/Tokyo, UTC+9)
 */

const TOKYO_TIMEZONE = 'Asia/Tokyo';

/**
 * Get current date in Tokyo timezone (YYYY-MM-DD format)
 */
export function getTokyoDate(): string {
  const now = new Date();
  const tokyoDate = new Date(now.toLocaleString('en-US', { timeZone: TOKYO_TIMEZONE }));

  // IMPORTANT for NBA: Tokyo "Today" corresponds to US "Yesterday" games
  // So if it is Jan 24 in Tokyo, we want to show Jan 23 US games
  // We subtract 1 day from the Tokyo date to get the "NBA Game Date"
  const nbaDate = new Date(tokyoDate);
  nbaDate.setDate(nbaDate.getDate() - 1);

  const year = nbaDate.getFullYear();
  const month = String(nbaDate.getMonth() + 1).padStart(2, '0');
  const day = String(nbaDate.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

/**
 * Convert a date string to Tokyo timezone
 * @param dateStr - Date string in any format (ISO, YYYY-MM-DD, etc.)
 * @returns Date string in YYYY-MM-DD format in Tokyo timezone
 */
export function toTokyoDate(dateStr: string): string {
  if (!dateStr) return getTokyoDate();

  try {
    // Parse the date string (assume it's in local time or UTC)
    const date = new Date(dateStr);

    // Convert to Tokyo timezone
    const tokyoDate = new Date(date.toLocaleString('en-US', { timeZone: TOKYO_TIMEZONE }));

    const year = tokyoDate.getFullYear();
    const month = String(tokyoDate.getMonth() + 1).padStart(2, '0');
    const day = String(tokyoDate.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  } catch {
    return getTokyoDate();
  }
}

/**
 * Get current datetime in Tokyo timezone (ISO format)
 */
export function getTokyoDateTime(): string {
  const now = new Date();
  const tokyoDate = new Date(now.toLocaleString('en-US', { timeZone: TOKYO_TIMEZONE }));
  return tokyoDate.toISOString();
}

/**
 * Format a date string for display in Tokyo timezone
 */
export function formatTokyoDate(dateStr: string, options?: Intl.DateTimeFormatOptions): string {
  if (!dateStr) return '';

  try {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
      timeZone: TOKYO_TIMEZONE,
      ...options,
    });
  } catch {
    return dateStr;
  }
}

/**
 * Check if a date string is today in Tokyo timezone
 */
export function isTodayTokyo(dateStr: string): boolean {
  const today = getTokyoDate();
  return dateStr === today;
}

/**
 * Create a Date object representing a date in Tokyo timezone
 */
export function createTokyoDate(dateStr: string): Date {
  if (!dateStr) {
    return new Date(new Date().toLocaleString('en-US', { timeZone: TOKYO_TIMEZONE }));
  }

  // Parse YYYY-MM-DD and create date in Tokyo timezone
  const [year, month, day] = dateStr.split('-').map(Number);
  const dateStrTokyo = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00+09:00`;
  return new Date(dateStrTokyo);
}
