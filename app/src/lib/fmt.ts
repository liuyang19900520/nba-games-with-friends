import { getLang } from './i18n'
export const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
export const addDays = (s: string, n: number) => { const [y, m, d] = s.split('-').map(Number); return ymd(new Date(y, m - 1, d + n)) }
/** ESPN "game date" is US Eastern; default the date switcher to ET today */
export function etToday() {
  const p = new Date(Date.now() - 4 * 3600e3) // ET approx (EDT); fine for a default
  return `${p.getUTCFullYear()}-${String(p.getUTCMonth() + 1).padStart(2, '0')}-${String(p.getUTCDate()).padStart(2, '0')}`
}
export function localTime(iso?: string) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(+d)) return ''
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
export function localDateTime(iso?: string) {
  if (!iso) return ''
  const d = new Date(iso); if (isNaN(+d)) return String(iso)
  return `${d.getMonth() + 1}/${d.getDate()} ${localTime(iso)}`
}
const WD_ZH = ['日', '一', '二', '三', '四', '五', '六'], WD_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export function dayLabel(s: string) {
  const [y, m, d] = s.split('-').map(Number); const w = new Date(y, m - 1, d).getDay()
  return getLang() === 'zh' ? `${m}月${d}日 周${WD_ZH[w]}` : `${WD_EN[w]} ${m}/${d}`
}
export function num(v: any, dig = 1): string {
  if (v === null || v === undefined || v === '') return '-'
  const n = Number(v); if (!isFinite(n)) return String(v)
  return Number.isInteger(n) ? String(n) : n.toFixed(dig)
}
export function pct(v: any): string {
  if (v === null || v === undefined) return '-'
  const n = Number(v); if (!isFinite(n)) return '-'
  return (n <= 1 ? n * 100 : n).toFixed(1) + '%'
}
export function money(v: any): string {
  if (v === null || v === undefined) return '-'
  const n = Number(v); return n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : `$${n.toLocaleString()}`
}
export const seasonLabel = (s: number) => `${s - 1}-${String(s).slice(2)}`

const INT = /^(gp|gs|dd2|td3|.*_total|total_.*|rank|age|experience|seed|wins|losses)$/
/** stat value: integer keys as-is, everything else 1 decimal (36 -> 36.0) */
export function stat(k: string, v: any): string {
  if (v === null || v === undefined || v === '') return '-'
  const n = Number(v); if (!isFinite(n)) return String(v)
  if (/pct|rate/.test(k)) return n.toFixed(1) + '%'
  return INT.test(k) ? String(Math.round(n)) : n.toFixed(1)
}
