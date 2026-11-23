export type FantasyRule = { key: string; labelZh: string; labelEn: string; weight: number }
export type FantasyRules = { stats: FantasyRule[]; doubleDouble: number; tripleDouble: number }

export const defaultRules: FantasyRules = {
  stats: [
    { key: 'min', labelZh: '上场时间', labelEn: 'Minutes', weight: 0 },
    { key: 'pts', labelZh: '得分', labelEn: 'Points', weight: 1 },
    { key: 'reb', labelZh: '篮板', labelEn: 'Rebounds', weight: 1.2 },
    { key: 'oreb', labelZh: '前场篮板', labelEn: 'Off. rebounds', weight: 0 },
    { key: 'dreb', labelZh: '后场篮板', labelEn: 'Def. rebounds', weight: 0 },
    { key: 'ast', labelZh: '助攻', labelEn: 'Assists', weight: 1.5 },
    { key: 'stl', labelZh: '抢断', labelEn: 'Steals', weight: 3 },
    { key: 'blk', labelZh: '盖帽', labelEn: 'Blocks', weight: 3 },
    { key: 'tov', labelZh: '失误', labelEn: 'Turnovers', weight: -1 },
    { key: 'pf', labelZh: '犯规', labelEn: 'Fouls', weight: 0 },
    { key: 'fgm', labelZh: '投篮命中', labelEn: 'FG made', weight: 0 },
    { key: 'fga', labelZh: '投篮出手', labelEn: 'FG attempts', weight: 0 },
    { key: 'fg3m', labelZh: '三分命中', labelEn: '3PT made', weight: 0 },
    { key: 'fg3a', labelZh: '三分出手', labelEn: '3PT attempts', weight: 0 },
    { key: 'ftm', labelZh: '罚球命中', labelEn: 'FT made', weight: 0 },
    { key: 'fta', labelZh: '罚球出手', labelEn: 'FT attempts', weight: 0 },
    { key: 'plus_minus', labelZh: '正负值', labelEn: 'Plus/minus', weight: 0 },
  ],
  doubleDouble: 1.5,
  tripleDouble: 3,
}

export const fantasyRuleStorageKey = 'fantasy:rules:v1'
export const cloneDefaultRules = (): FantasyRules => JSON.parse(JSON.stringify(defaultRules))
const numeric = (value: any): number | undefined => {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

export function normalizeRules(input: any): FantasyRules {
  const defaults = cloneDefaultRules()
  if (!input || !Array.isArray(input.stats)) return defaults
  const stats = defaults.stats.map((base) => {
    const rule = input.stats.find((x: any) => x?.key === base.key)
    return { ...base, weight: numeric(rule?.weight) ?? base.weight }
  })
  return {
    stats,
    doubleDouble: numeric(input.doubleDouble) ?? defaults.doubleDouble,
    tripleDouble: numeric(input.tripleDouble) ?? defaults.tripleDouble,
  }
}

export type FantasyBreakdownItem = { key: string; value: number; weight: number; points: number }
export type FantasyScore = { score: number; breakdown: FantasyBreakdownItem[]; bonus?: { key: string; points: number }; dnp: boolean }

const numberValue = (v: any): number => {
  const raw = v && typeof v === 'object' ? (v.value ?? v.points) : v
  const n = Number(raw)
  return Number.isFinite(n) ? n : 0
}

/** Calculates one player's fantasy score. A triple-double gets only the triple-double bonus. */
export function calcFantasyScore(statLine: any, rules: FantasyRules = defaultRules): FantasyScore {
  if (!statLine || statLine.dnp === true || statLine.minutes === 'DNP') return { score: 0, breakdown: [], dnp: true }
  const normalized = normalizeRules(rules)
  const breakdown = normalized.stats.map(({ key, weight }) => {
    const value = numberValue(statLine[key])
    return { key, value, weight, points: value * weight }
  })
  const positiveCounts = ['pts', 'reb', 'ast', 'stl', 'blk'].filter((key) => numberValue(statLine[key]) >= 10).length
  const bonus = positiveCounts >= 3
    ? { key: 'tripleDouble', points: normalized.tripleDouble }
    : positiveCounts >= 2 ? { key: 'doubleDouble', points: normalized.doubleDouble } : undefined
  return { score: breakdown.reduce((sum, x) => sum + x.points, 0) + (bonus?.points || 0), breakdown, bonus, dnp: false }
}
