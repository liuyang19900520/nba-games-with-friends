import Taro from '@tarojs/taro'
import { FantasyRules, calcFantasyScore, cloneDefaultRules } from './fantasy'
import { readFantasyRules, saveFantasyRules } from './fantasyStorage'

export type Slot = 'C' | 'F1' | 'F2' | 'G1' | 'G2'

export const LINEUP_SLOTS: { key: Slot; base: 'C' | 'F' | 'G'; labelZh: string; labelEn: string }[] = [
  { key: 'C', base: 'C', labelZh: '中锋', labelEn: 'C' },
  { key: 'F1', base: 'F', labelZh: '大前', labelEn: 'F1' },
  { key: 'F2', base: 'F', labelZh: '小前', labelEn: 'F2' },
  { key: 'G1', base: 'G', labelZh: '控卫', labelEn: 'G1' },
  { key: 'G2', base: 'G', labelZh: '分卫', labelEn: 'G2' },
]

export interface RulePreset {
  key: string
  nameZh: string
  nameEn: string
  rules: FantasyRules
}

function makePreset(key: string, nameZh: string, nameEn: string, overrides: Record<string, number>, dd2 = 1.5, td3 = 3): RulePreset {
  const base = cloneDefaultRules()
  base.stats = base.stats.map((s) => (overrides[s.key] !== undefined ? { ...s, weight: overrides[s.key] } : s))
  base.doubleDouble = dd2
  base.tripleDouble = td3
  return { key, nameZh, nameEn, rules: base }
}

export const RULE_PRESETS: RulePreset[] = [
  makePreset('std', '标准综合分', 'Standard', { pts: 1, reb: 1.2, ast: 1.5, stl: 3, blk: 3, fg3m: 0, tov: -1 }),
  makePreset('off', '进攻狂潮', 'Offense Surge', { pts: 1.5, reb: 1.0, ast: 1.5, stl: 2, blk: 2, fg3m: 2, tov: -1 }),
  makePreset('def', '攻防铁血', 'Two-Way Grit', { pts: 1, reb: 1.5, ast: 1.5, stl: 4.5, blk: 4.5, fg3m: 0, tov: -2 }),
]

export const DEFAULT_SALARY_CAP = 185_000_000 // $185.0M

const KEY_LINEUP = 'lineup:v2'
const KEY_CAP = 'scoring:cap:v2'
const KEY_ROOM = 'scoring:room:v2'

export interface SavedLineup {
  date: string
  locked?: boolean
  lockedAt?: string
  slots: Partial<Record<Slot, any>>
}

export interface DailyBox {
  min: number
  pts: number
  reb: number
  ast: number
  stl: number
  blk: number
  tov: number
  fg3m: number
  fg: string
  status: 'live' | 'final'
  statusText: string
}

export interface ScoreResult {
  total: number
  bonusPoints: number
  bonusKey?: string
  breakdown: {
    pts: number
    reb: number
    ast: number
    def: number
    fg3m: number
    tov: number
  }
}

export interface FriendEntry {
  id: string
  name: string
  badgeZh: string
  badgeEn: string
  liveCount: number
  slots: Partial<Record<Slot, any>>
}

export interface RoomState {
  code: string
  name: string
}

export function loadLineup(): SavedLineup {
  try {
    const v = Taro.getStorageSync(KEY_LINEUP)
    if (v && typeof v === 'object') return { date: v.date || '', locked: !!v.locked, lockedAt: v.lockedAt, slots: v.slots || {} }
  } catch (e) {}
  return { date: '', locked: false, slots: {} }
}

export function saveLineup(data: SavedLineup) {
  try { Taro.setStorageSync(KEY_LINEUP, data) } catch (e) {}
}

export function loadCap(): number {
  try {
    const v = Number(Taro.getStorageSync(KEY_CAP))
    if (v >= 100_000_000 && v <= 300_000_000) return v
  } catch (e) {}
  return DEFAULT_SALARY_CAP
}

export function saveCap(cap: number) {
  try { Taro.setStorageSync(KEY_CAP, cap) } catch (e) {}
}

export const loadRule = (): FantasyRules => readFantasyRules()
export const saveRule = (rules: FantasyRules): void => saveFantasyRules(rules)

export function loadRoom(): RoomState {
  try {
    const v = Taro.getStorageSync(KEY_ROOM)
    if (v && v.code) return v
  } catch (e) {}
  return { code: '8829', name: '周末篮球老友局' }
}

export function saveRoom(room: RoomState) {
  try { Taro.setStorageSync(KEY_ROOM, room) } catch (e) {}
}

export function formatRuleFormula(r: FantasyRules): string {
  const active = r.stats.filter((s) => s.weight !== 0)
  return active.map((s) => `${s.key.toUpperCase()}×${s.weight}`).join(' + ').replace(/\+ ([A-Z0-9_]+)×-/g, '- $1×')
}

function hashSeed(str: string): number {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) / 4294967295
}

export function getPlayerDailyBox(p: any, date: string, tick = 0): DailyBox {
  const r1 = hashSeed(`${p?.id}:${date}:1:${tick}`)
  const r2 = hashSeed(`${p?.id}:${date}:2:${tick}`)
  const r3 = hashSeed(`${p?.id}:${date}:3:${tick}`)
  const r4 = hashSeed(`${p?.id}:${date}:4:${tick}`)

  const basePts = Number(p?.pts) || 12
  const baseReb = Number(p?.reb) || 4
  const baseAst = Number(p?.ast) || 3
  const baseStl = Number(p?.stl) || 0.8
  const baseBlk = Number(p?.blk) || 0.5
  const baseMin = Number(p?.min) || 26

  const mult = 0.78 + r1 * 0.52
  const pts = Math.max(2, Math.round(basePts * mult))
  const reb = Math.max(0, Math.round(baseReb * (0.7 + r2 * 0.65)))
  const ast = Math.max(0, Math.round(baseAst * (0.7 + r3 * 0.65)))
  const stl = Math.max(0, Math.round(baseStl * (0.5 + r4 * 1.4)))
  const blk = Math.max(0, Math.round(baseBlk * (0.5 + r1 * 1.4)))
  const tov = Math.max(0, Math.round((1.2 + baseAst * 0.28) * (0.6 + r2 * 0.8)))
  const fg3m = Math.max(0, Math.round((pts * 0.12) * (0.4 + r3 * 1.1)))
  const fga = Math.max(Math.ceil(pts / 2), Math.round(pts * 0.72 + 2))
  const fgm = Math.min(fga, Math.max(1, Math.round(pts * 0.38)))
  const min = Math.min(44, Math.max(16, Math.round(baseMin * (0.85 + r4 * 0.25))))
  const isLive = r4 > 0.45

  return {
    min, pts, reb, ast, stl, blk, tov, fg3m,
    fg: `${fgm}/${fga}`,
    status: isLive ? 'live' : 'final',
    statusText: isLive ? `LIVE Q4 0${Math.floor(r1 * 8) + 1}:${String(Math.floor(r2 * 50) + 10)}` : 'FINAL',
  }
}

export function calcPlayerScore(box: DailyBox, rules: FantasyRules): ScoreResult {
  const res = calcFantasyScore(box, rules)
  const get = (k: string) => Math.round((res.breakdown.find((x) => x.key === k)?.points || 0) * 10) / 10
  return {
    total: Math.round(res.score * 10) / 10,
    bonusPoints: Math.round((res.bonus?.points || 0) * 10) / 10,
    bonusKey: res.bonus?.key,
    breakdown: {
      pts: get('pts'),
      reb: get('reb'),
      ast: get('ast'),
      def: Math.round((get('stl') + get('blk')) * 10) / 10,
      fg3m: get('fg3m'),
      tov: get('tov'),
    },
  }
}

const fitsPos = (p: any, base: 'C' | 'F' | 'G') => String(p?.position || '').toUpperCase().includes(base)

export function buildAutoLineup(players: any[], cap: number, seedOffset = 0): Partial<Record<Slot, any>> {
  const pool = players.filter((p) => p && p.salary > 0 && p.pts != null)
  if (!pool.length) return {}

  const pickFor = (base: 'C' | 'F' | 'G', maxSal: number, used: Set<any>, bias: number) => {
    const cands = pool
      .filter((p) => fitsPos(p, base) && !used.has(p.id) && Number(p.salary) <= maxSal)
      .sort((a, b) => {
        const va = (Number(a.pts) || 0) + (Number(a.reb) || 0) * 1.1 + (Number(a.ast) || 0) * 1.2
        const vb = (Number(b.pts) || 0) + (Number(b.reb) || 0) * 1.1 + (Number(b.ast) || 0) * 1.2
        return vb - va
      })
    if (!cands.length) {
      const fallback = pool.filter((p) => fitsPos(p, base) && !used.has(p.id)).sort((a, b) => Number(a.salary) - Number(b.salary))
      return fallback[0] || null
    }
    const idx = Math.min(cands.length - 1, bias % Math.min(6, cands.length))
    return cands[idx]
  }

  const slots: Partial<Record<Slot, any>> = {}
  const used = new Set<any>()
  let rem = cap
  const minReserve = 6_000_000

  LINEUP_SLOTS.forEach((s, i) => {
    const leftCount = LINEUP_SLOTS.length - 1 - i
    const budget = Math.max(5_000_000, rem - leftCount * minReserve)
    const picked = pickFor(s.base, budget, used, seedOffset + i)
    if (picked) {
      slots[s.key] = picked
      used.add(picked.id)
      rem -= Number(picked.salary) || 0
    }
  })

  return slots
}

export function buildMockFriends(players: any[], cap: number): FriendEntry[] {
  const profiles = [
    { id: 'f1', name: '阿杰 DunkMaster', badgeZh: '上周冠军', badgeEn: 'Last Wk #1', liveCount: 3, seed: 1 },
    { id: 'f2', name: '老王 HoopsFan', badgeZh: '性价比之王', badgeEn: 'Value King', liveCount: 2, seed: 3 },
    { id: 'f3', name: '大伟 Crossover', badgeZh: '三分狂魔', badgeEn: '3PT Sniper', liveCount: 1, seed: 5 },
    { id: 'f4', name: '小林 BeardFan', badgeZh: '防守悍将', badgeEn: 'Lockdown D', liveCount: 2, seed: 7 },
  ]
  return profiles.map((f) => ({
    id: f.id,
    name: f.name,
    badgeZh: f.badgeZh,
    badgeEn: f.badgeEn,
    liveCount: f.liveCount,
    slots: buildAutoLineup(players, cap, f.seed),
  }))
}
