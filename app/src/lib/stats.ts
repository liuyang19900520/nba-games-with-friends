// Stat key -> [zh, en] labels. Unknown keys fall back to the raw key (so new ESPN fields still show).
import { getLang } from './i18n'
const L: Record<string, [string, string]> = {
  gp: ['出场', 'GP'], gs: ['首发', 'GS'], min: ['时间', 'MIN'], minutes: ['时间', 'MIN'], mpg: ['时间', 'MIN'],
  pts: ['得分', 'PTS'], ppg: ['得分', 'PPG'], reb: ['篮板', 'REB'], rpg: ['篮板', 'REB'], oreb: ['前板', 'OREB'], dreb: ['后板', 'DREB'],
  oreb_pg: ['前场篮板', 'OREB'], dreb_pg: ['后场篮板', 'DREB'], ast: ['助攻', 'AST'], apg: ['助攻', 'AST'], stl: ['抢断', 'STL'], spg: ['抢断', 'STL'],
  blk: ['盖帽', 'BLK'], bpg: ['盖帽', 'BLK'], tov: ['失误', 'TO'], topg: ['失误', 'TO'], tov_pg: ['失误', 'TO'], pf: ['犯规', 'PF'], pf_pg: ['犯规', 'PF'],
  fgm: ['投中', 'FGM'], fga: ['出手', 'FGA'], fg_pct: ['投篮%', 'FG%'], fg3m: ['三分中', '3PM'], fg3a: ['三分投', '3PA'],
  fg3_pct: ['三分%', '3P%'], fg3m_total: ['三分总命中', '3PM tot'], fg3m_pg: ['场均三分', '3PM/G'], ftm: ['罚中', 'FTM'], fta: ['罚球', 'FTA'], ft_pct: ['罚球%', 'FT%'],
  plus_minus: ['+/-', '+/-'], ts_pct: ['真实命中率', 'TS%'], efg_pct: ['有效命中率', 'eFG%'], game_score_avg: ['GmSc', 'GmSc'],
  usg_pct: ['使用率', 'USG%'], per: ['PER', 'PER'], dd2: ['两双', 'DD2'], td3: ['三双', 'TD3'], salary: ['薪资', 'Salary'],
  fgm_pg: ['场均投中', 'FGM'], fga_pg: ['场均出手', 'FGA'], ftm_pg: ['场均罚中', 'FTM'], fta_pg: ['场均罚球', 'FTA'], fg3a_pg: ['场均三分出手', '3PA'],
  points_in_paint: ['内线得分', 'Paint PTS'], points_off_turnovers: ['利用失误得分', 'Pts off TO'], fast_break_points: ['快攻得分', 'Fast break'],
  ast_to: ['助攻失误比', 'AST/TO'], season: ['赛季', 'Season'], team_abbr: ['球队', 'Team'], date: ['日期', 'Date'], opp: ['对手', 'OPP'],
  starter: ['首发', 'Start'], result: ['胜负', 'W/L'], home_away: ['主客', 'H/A'], w: ['胜', 'W'], l: ['负', 'L'], win_pct: ['胜率', 'PCT'], gb: ['胜场差', 'GB'],
  streak: ['连胜/负', 'STRK'], home_record: ['主场', 'Home'], away_record: ['客场', 'Away'], last_ten: ['近10场', 'L10'], ppg_diff: ['分差', 'DIFF'],
  opp_ppg: ['失分', 'OPP PTS'], conf_rank: ['排名', 'Rank'], gp_gs: ['出场/首发', 'GP/GS'], ha: ['主客', 'H/A'], wins: ['胜', 'W'], losses: ['负', 'L'], games_behind: ['胜场差', 'GB'], home: ['主场', 'Home'], away: ['客场', 'Away'], conf: ['分区内', 'Conf'], div: ['赛区内', 'Div'], last10: ['近10场', 'L10'], diff: ['分差', 'DIFF'], seed: ['种子', 'Seed'], age: ['年龄', 'Age'], experience: ['球龄', 'Exp'], jersey: ['号码', '#'], nba_rating: ['NBA评分', 'Rating'], usage_rate: ['使用率', 'USG%'], vorp: ['VORP', 'VORP'], reb_rate: ['篮板率', 'REB%'], pts_per_poss: ['每回合得分', 'PTS/Poss'], stl_to: ['抢断失误比', 'STL/TO'], pts_total: ['总得分', 'PTS'], label: ['赛季', 'Season'], score: ['比分', 'Score'],
}
export const label = (k: string) => (L[k] ? L[k][getLang() === 'zh' ? 0 : 1] : k.replace(/_/g, ' ').toUpperCase())
export const isPct = (k: string) => /pct|_pct$|%/.test(k)
const SKIP = /(^id$|_id$|url|^name|_zh$|^player$|^team$|^position|^pos_group|^jersey|^season_type$|^updated|^fetched|^created|^dnp_reason|^headshot|^abbr$)/
/** numeric columns present in data, keeping `prefer` order first */
export function autoCols(rows: any[], prefer: string[] = []): string[] {
  const ks = new Set<string>()
  rows.slice(0, 5).forEach((r) => Object.keys(r || {}).forEach((k) => {
    const v = r[k]
    if (!SKIP.test(k) && (typeof v === 'number' || (typeof v === 'string' && v !== '' && !isNaN(Number(v))) || typeof v === 'boolean')) ks.add(k)
  }))
  const out = prefer.filter((k) => ks.has(k))
  ks.forEach((k) => { if (!out.includes(k)) out.push(k) })
  return out
}

const ST: Record<string, [string, string]> = { 1: ['季前赛', 'Preseason'], 2: ['常规赛', 'Regular Season'], 3: ['季后赛', 'Playoffs'], 5: ['附加赛', 'Play-In'] }
export const seasonTypeLabel = (n: any) => (ST[n] ? ST[n][getLang() === 'zh' ? 0 : 1] : '')
/** merge server-provided labels (/meta stat_labels) */
export function mergeLabels(m: Record<string, any> = {}) {
  Object.keys(m).forEach((k) => { const v = m[k]; if (v && (v.zh || v.abbr)) L[k] = [v.zh || v.abbr, v.abbr || v.en || k] })
}
export const FALLBACK_CATS = {
  basic: [['pts', '得分', 'Points'], ['reb', '篮板', 'Rebounds'], ['oreb', '前场篮板', 'Off Reb'], ['dreb', '后场篮板', 'Def Reb'], ['ast', '助攻', 'Assists'],
    ['stl', '抢断', 'Steals'], ['blk', '盖帽', 'Blocks'], ['tov', '失误', 'Turnovers'], ['pf', '犯规', 'Fouls'], ['min', '上场时间', 'Minutes'], ['fg_pct', '投篮命中率', 'FG%'],
    ['fgm', '场均投篮命中', 'FGM'], ['fg3m_total', '三分总命中数', '3PM total'], ['fg3m', '场均三分命中', '3PM'], ['fg3_pct', '三分命中率', '3P%'],
    ['ft_pct', '罚球命中率', 'FT%'], ['ftm', '场均罚球命中', 'FTM'], ['dd2', '两双', 'Double-doubles'], ['td3', '三双', 'Triple-doubles'], ['pts_total', '总得分', 'Total pts']],
  advanced: [['per', 'PER效率值', 'PER'], ['ts_pct', '真实命中率', 'TS%'], ['efg_pct', '有效命中率', 'eFG%'], ['nba_rating', 'NBA评分', 'NBA Rating'],
    ['usage_rate', '球权使用率', 'USG%'], ['vorp', 'VORP', 'VORP'], ['ast_to', '助攻失误比', 'AST/TO'], ['reb_rate', '篮板率', 'REB%'],
    ['pts_per_poss', '每回合得分', 'PTS/Poss'], ['plus_minus', '正负值', '+/-'], ['stl_to', '抢断失误比', 'STL/TO']],
}
