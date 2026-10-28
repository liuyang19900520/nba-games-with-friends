import { api } from './api'
import { mergeLabels, FALLBACK_CATS } from './stats'
let p: Promise<any> | null = null
const CUR = 2027
export const fallbackMeta = {
  current_season: CUR,
  seasons: [{ season: CUR, label: '2026-27', types: [1, 2] }, { season: CUR - 1, label: '2025-26', types: [2, 3] }],
  leader_categories: {
    basic: FALLBACK_CATS.basic.map(([key, zh, en]) => ({ key, zh, en })),
    advanced: FALLBACK_CATS.advanced.map(([key, zh, en]) => ({ key, zh, en })),
  },
}
/** /meta once per session; never rejects (falls back to local defaults) */
export function loadMeta(): Promise<any> {
  if (!p) p = api.meta().then((m) => { mergeLabels(m.stat_labels); return { ...fallbackMeta, ...m } }, () => { p = null; return fallbackMeta })
  return p
}
