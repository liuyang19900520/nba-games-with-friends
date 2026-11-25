import { getLang } from './i18n'
import { money, stat } from './fmt'
import { teamName } from './teams'

export type Slot = 'C' | 'F1' | 'F2' | 'G1' | 'G2'
export type BasePos = 'C' | 'F' | 'G'
export type AiStrategy = 'balanced' | 'scoring' | 'allaround' | 'value' | 'random'

export const SLOTS: { key: Slot; base: BasePos; cls: string }[] = [
  { key: 'C', base: 'C', cls: 's-c' },
  { key: 'F1', base: 'F', cls: 's-f1' },
  { key: 'F2', base: 'F', cls: 's-f2' },
  { key: 'G1', base: 'G', cls: 's-g1' },
  { key: 'G2', base: 'G', cls: 's-g2' },
]

export interface AiOptions {
  strategy: AiStrategy
  onlyTonight: boolean
  skipInjured: boolean
  keepExisting: boolean
  maxCap?: number
  variation?: number
}

export interface AiPick {
  slot: Slot
  base: BasePos
  player: any
  reason: string
  isExisting?: boolean
}

export interface AiResult {
  picks: AiPick[]
  summary: { pts: number; reb: number; ast: number; salary: number }
  strategy: AiStrategy
  usedFallbackPool: boolean
}

export const STRATEGIES: { key: AiStrategy; zh: string; en: string; descZh: string; descEn: string }[] = [
  { key: 'balanced', zh: '综合均衡', en: 'Balanced', descZh: '兼顾得分、篮板、助攻与位置适配', descEn: 'Balances scoring, rebounds, assists & fit' },
  { key: 'scoring', zh: '火力全开', en: 'Scoring', descZh: '优先挑选场均得分最高的进攻核心', descEn: 'Prioritizes top scorers for maximum offense' },
  { key: 'allaround', zh: '全能数据', en: 'All-Around', descZh: '偏爱能得分、能抢板、能串联的全能球星', descEn: 'Targets versatile multi-category contributors' },
  { key: 'value', zh: '高性价比', en: 'Best Value', descZh: '结合薪资挖掘高产出的实力球员', descEn: 'High-impact production relative to salary' },
  { key: 'random', zh: '随机惊喜', en: 'Surprise Me', descZh: '从各位置优质球员中随机组合灵感阵容', descEn: 'Weighted random mix of top-tier players' },
]

const fits = (pos: string, base: BasePos) => String(pos || '').toUpperCase().includes(base)

function scorePlayer(p: any, base: BasePos, strategy: AiStrategy): number {
  const pts = Number(p.pts) || 0
  const reb = Number(p.reb) || 0
  const ast = Number(p.ast) || 0
  const gp = Number(p.gp) || 0
  const salM = (Number(p.salary) || 0) / 1e6
  const posBonus = base === 'C' ? reb * 0.35 : base === 'G' ? ast * 0.35 : (pts + reb) * 0.1
  const activeBonus = gp > 0 ? Math.min(gp, 15) * 0.15 : -20

  switch (strategy) {
    case 'scoring':
      return pts * 1.65 + (pts >= 22 ? 4 : 0) + ast * 0.25 + reb * 0.2 + activeBonus
    case 'allaround':
      return pts * 0.95 + reb * 1.45 + ast * 1.65 + activeBonus
    case 'value': {
      const prod = pts + reb * 1.1 + ast * 1.25
      const floorPenalty = pts < 8 ? 0.45 : 1
      return (prod / Math.max(salM, 2.5)) * 10 * floorPenalty + activeBonus * 0.5
    }
    case 'random':
    case 'balanced':
    default:
      return pts * 1.0 + reb * 1.15 + ast * 1.3 + posBonus + activeBonus
  }
}

function buildMatchupMap(tonight: any[]): Map<number, string> {
  const map = new Map<number, string>()
  const isZh = getLang() === 'zh'
  for (const g of tonight || []) {
    if (g.away?.id && g.home?.id) {
      map.set(g.away.id, `${isZh ? '客战' : '@ '}${teamName(g.home)}`)
      map.set(g.home.id, `${isZh ? '主场战' : 'vs '}${teamName(g.away)}`)
    }
  }
  return map
}

function buildReason(p: any, base: BasePos, strategy: AiStrategy, matchup?: string): string {
  const isZh = getLang() === 'zh'
  const pts = p.pts != null ? stat('pts', p.pts) : '0'
  const reb = p.reb != null ? stat('reb', p.reb) : '0'
  const ast = p.ast != null ? stat('ast', p.ast) : '0'
  const matchNote = matchup ? (isZh ? ` · 今晚${matchup}` : ` · ${matchup}`) : ''

  if (strategy === 'scoring') {
    return isZh
      ? `场均 ${pts} 分领衔火力，${reb} 板 ${ast} 助${matchNote}`
      : `${pts} PPG scoring threat (${reb} REB, ${ast} AST)${matchNote}`
  }
  if (strategy === 'allaround') {
    return isZh
      ? `全面输出 ${pts} 分 ${reb} 板 ${ast} 助${matchNote}`
      : `All-around ${pts} PTS / ${reb} REB / ${ast} AST${matchNote}`
  }
  if (strategy === 'value') {
    const sal = p.salary ? money(p.salary) : (isZh ? '底薪/未知' : 'N/A')
    return isZh
      ? `薪资 ${sal}，贡献 ${pts} 分 ${reb} 板 ${ast} 助${matchNote}`
      : `${sal} salary producing ${pts} PTS / ${reb} REB / ${ast} AST${matchNote}`
  }
  if (base === 'C') {
    return isZh
      ? `场均 ${reb} 篮板 ${pts} 分，内线攻防支柱${matchNote}`
      : `${reb} RPG & ${pts} PPG anchoring the paint${matchNote}`
  }
  if (base === 'G') {
    return isZh
      ? `场均 ${pts} 分 ${ast} 助攻，后场进攻发动机${matchNote}`
      : `${pts} PPG & ${ast} APG backcourt playmaker${matchNote}`
  }
  return isZh
    ? `场均 ${pts} 分 ${reb} 板 ${ast} 助，锋线稳定输出${matchNote}`
    : `${pts} PPG, ${reb} RPG, ${ast} APG wing impact${matchNote}`
}

export function generateAiLineup(
  allPlayers: any[],
  tonight: any[],
  currentSlots: Partial<Record<Slot, any>>,
  options: AiOptions,
): AiResult {
  const isZh = getLang() === 'zh'
  const tonightTeamIds = new Set<number>()
  for (const g of tonight || []) {
    if (g.away?.id) tonightTeamIds.add(g.away.id)
    if (g.home?.id) tonightTeamIds.add(g.home.id)
  }
  const matchups = buildMatchupMap(tonight)
  const picksBySlot: Partial<Record<Slot, AiPick>> = {}
  const taken = new Set<number>()
  let usedFallbackPool = false

  if (options.keepExisting) {
    for (const s of SLOTS) {
      const existing = currentSlots[s.key]
      if (existing?.id) {
        taken.add(existing.id)
        picksBySlot[s.key] = {
          slot: s.key,
          base: s.base,
          player: existing,
          reason: isZh ? '已锁定保留在当前阵容中' : 'Kept from your current lineup',
          isExisting: true,
        }
      }
    }
  }

  // Fill C first (scarcest), then F1, F2, G1, G2
  const fillOrder = SLOTS.filter((s) => !picksBySlot[s.key])
  const variation = options.variation || 0
  let spent = Object.values(picksBySlot).reduce((sum, item) => sum + (Number(item?.player?.salary) || 0), 0)
  const MIN_RESERVE = 2_000_000

  for (let idx = 0; idx < fillOrder.length; idx++) {
    const s = fillOrder[idx]
    const slotsLeftAfter = fillOrder.length - idx - 1
    const maxForSlot = options.maxCap ? Math.max(0, options.maxCap - spent - slotsLeftAfter * MIN_RESERVE) : Infinity

    const pickFrom = (restrictTonight: boolean, restrictInjury: boolean, restrictCap: boolean) => {
      return allPlayers
        .filter((p) => {
          if (!p?.id || taken.has(p.id)) return false
          if (!fits(p.position, s.base)) return false
          if (restrictInjury && p.injury_status) return false
          if (restrictTonight && tonightTeamIds.size > 0 && !tonightTeamIds.has(p.team?.id)) return false
          if (restrictCap && (Number(p.salary) || 0) > maxForSlot) return false
          return true
        })
        .map((p) => ({ p, score: scorePlayer(p, s.base, options.strategy) }))
        .sort((a, b) => b.score - a.score)
    }

    let candidates = pickFrom(options.onlyTonight, options.skipInjured, Boolean(options.maxCap))
    if (!candidates.length && options.skipInjured) {
      candidates = pickFrom(options.onlyTonight, false, Boolean(options.maxCap))
    }
    if (!candidates.length && options.onlyTonight) {
      usedFallbackPool = true
      candidates = pickFrom(false, options.skipInjured, Boolean(options.maxCap))
    }
    if (!candidates.length && options.maxCap) {
      // If cap is too tight, pick the lowest-salary eligible player
      candidates = pickFrom(false, options.skipInjured, false).sort(
        (a, b) => (Number(a.p.salary) || 0) - (Number(b.p.salary) || 0),
      )
    }
    if (!candidates.length) {
      usedFallbackPool = true
      candidates = pickFrom(false, false, false)
    }

    if (!candidates.length) continue

    let chosen: any
    if (options.strategy === 'random') {
      const pool = candidates.slice(0, Math.min(14, candidates.length))
      const pickIdx = Math.floor(Math.random() * pool.length)
      chosen = pool[pickIdx].p
    } else if (variation > 0 && candidates.length > 1) {
      const topK = candidates.slice(0, Math.min(4, candidates.length))
      const offset = (variation + idx) % topK.length
      chosen = topK[offset].p
    } else {
      chosen = candidates[0].p
    }

    taken.add(chosen.id)
    spent += Number(chosen.salary) || 0
    picksBySlot[s.key] = {
      slot: s.key,
      base: s.base,
      player: chosen,
      reason: buildReason(chosen, s.base, options.strategy, matchups.get(chosen.team?.id)),
    }
  }

  const picks = SLOTS.map((s) => picksBySlot[s.key]).filter(Boolean) as AiPick[]
  const summary = picks.reduce(
    (acc, item) => ({
      pts: acc.pts + (Number(item.player?.pts) || 0),
      reb: acc.reb + (Number(item.player?.reb) || 0),
      ast: acc.ast + (Number(item.player?.ast) || 0),
      salary: acc.salary + (Number(item.player?.salary) || 0),
    }),
    { pts: 0, reb: 0, ast: 0, salary: 0 },
  )

  return { picks, summary, strategy: options.strategy, usedFallbackPool }
}
