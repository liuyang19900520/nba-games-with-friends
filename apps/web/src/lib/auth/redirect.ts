/** Only allow app-local destinations, including after an OAuth round trip. */
export function safeLocalRedirect(value: string | null | undefined, fallback = '/lineup'): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\') || [...value].some(char => char.charCodeAt(0) <= 32)) return fallback;
  const base = 'https://app.invalid';
  const target = new URL(value, base);
  return target.origin === base ? `${target.pathname}${target.search}${target.hash}` : fallback;
}
