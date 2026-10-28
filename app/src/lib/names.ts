// Player name display rule (docs/ui-navigation.md#names):
//  - detail pages / headers: fullName  (zh: name_zh, else ESPN full name)
//  - lists with room (leader rows, injury list): fullName, allowed to wrap to 2 lines — never ellipsized
//  - narrow table first column (box score, roster, game log): tableName
//      en: last name incl. suffix ("Shai Gilgeous-Alexander" → "Gilgeous-Alexander", "Jaren Jackson Jr." → "Jackson Jr.")
//      zh: name_zh if ≤ 4 chars, else the part after the last '·' ("谢伊·吉尔杰斯-亚历山大" → "吉尔杰斯-亚历山大")
//    may wrap to 2 lines; ambiguous duplicates in the same table get the first initial ("J. Williams").
import { getLang } from './i18n'
const SUFFIX = /^(jr\.?|sr\.?|ii|iii|iv|v)$/i
export function lastName(p: any): string {
  if (!p) return ''
  if (p.last_name) return p.last_name
  const parts = String(p.name || p.display_name || '').trim().split(/\s+/)
  if (parts.length <= 1) return parts[0] || ''
  const suf = SUFFIX.test(parts[parts.length - 1]) ? parts.pop() : ''
  return [parts[parts.length - 1], suf].filter(Boolean).join(' ')
}
const firstInitial = (p: any) => { const f = p?.first_name || String(p?.name || '').split(/\s+/)[0] || ''; return f ? f[0] + '. ' : '' }
export function fullName(p: any): string {
  if (!p) return ''
  return (getLang() === 'zh' && p.name_zh) || p.name || p.display_name || p.player_name || ''
}
export function zhShort(zh: string) { return zh.length <= 4 ? zh : zh.split('·').pop() || zh }
export function tableName(p: any, dupes?: Set<string>): string {
  if (!p) return ''
  if (getLang() === 'zh' && p.name_zh) return zhShort(p.name_zh)
  const ln = lastName(p)
  return dupes && dupes.has(ln) ? firstInitial(p) + ln : ln
}
/** last names that occur more than once in a list (to disambiguate) */
export function dupeLastNames(rows: any[]): Set<string> {
  const c: Record<string, number> = {}; rows.forEach((r) => { const l = lastName(r); if (l) c[l] = (c[l] || 0) + 1 })
  return new Set(Object.keys(c).filter((k) => c[k] > 1))
}
