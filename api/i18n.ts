// Static zh labels used by the API (team zh names live in DB table team_i18n; duplicated here only for /meta convenience is NOT needed).
export const SEASON_TYPES: Record<string, { en: string; zh: string }> = {
  "1": { en: "Preseason", zh: "季前赛" }, "2": { en: "Regular Season", zh: "常规赛" }, "3": { en: "Postseason", zh: "季后赛" }, "5": { en: "Play-In", zh: "附加赛" } };
export const INJURY_ZH: Record<string, string> = { Out: "缺阵", "Day-To-Day": "每日观察", Questionable: "出战成疑", Doubtful: "大概率缺阵",
  Probable: "大概率出战", Suspension: "禁赛", "Injured Reserve": "伤病名单", Active: "可出战" };
export const STATUS_ZH: Record<string, string> = { scheduled: "未开始", live: "进行中", final: "已结束", postponed: "延期", canceled: "取消" };
export const STAT_LABELS: Record<string, { en: string; zh: string; abbr: string }> = {
  gp: { en: "Games Played", zh: "出场", abbr: "GP" }, gs: { en: "Games Started", zh: "首发", abbr: "GS" },
  min: { en: "Minutes", zh: "上场时间", abbr: "MIN" }, pts: { en: "Points", zh: "得分", abbr: "PTS" },
  reb: { en: "Rebounds", zh: "篮板", abbr: "REB" }, oreb: { en: "Offensive Rebounds", zh: "前场篮板", abbr: "OREB" },
  dreb: { en: "Defensive Rebounds", zh: "后场篮板", abbr: "DREB" }, ast: { en: "Assists", zh: "助攻", abbr: "AST" },
  stl: { en: "Steals", zh: "抢断", abbr: "STL" }, blk: { en: "Blocks", zh: "盖帽", abbr: "BLK" },
  tov: { en: "Turnovers", zh: "失误", abbr: "TO" }, pf: { en: "Fouls", zh: "犯规", abbr: "PF" },
  fgm: { en: "Field Goals Made", zh: "投篮命中", abbr: "FGM" }, fga: { en: "Field Goals Attempted", zh: "投篮出手", abbr: "FGA" },
  fg3m: { en: "3-Pointers Made", zh: "场均三分命中", abbr: "3PM" }, fg3a: { en: "3-Pointers Attempted", zh: "三分出手", abbr: "3PA" },
  ftm: { en: "Free Throws Made", zh: "罚球命中", abbr: "FTM" }, fta: { en: "Free Throws Attempted", zh: "罚球出手", abbr: "FTA" },
  fg_pct: { en: "Field Goal %", zh: "投篮命中率", abbr: "FG%" }, fg3_pct: { en: "3-Point %", zh: "三分命中率", abbr: "3P%" },
  ft_pct: { en: "Free Throw %", zh: "罚球命中率", abbr: "FT%" }, ts_pct: { en: "True Shooting %", zh: "真实命中率", abbr: "TS%" },
  efg_pct: { en: "Effective FG %", zh: "有效命中率", abbr: "eFG%" }, pts_total: { en: "Total Points", zh: "总得分", abbr: "PTS" },
  reb_total: { en: "Total Rebounds", zh: "总篮板", abbr: "REB" }, ast_total: { en: "Total Assists", zh: "总助攻", abbr: "AST" },
  stl_total: { en: "Total Steals", zh: "总抢断", abbr: "STL" }, blk_total: { en: "Total Blocks", zh: "总盖帽", abbr: "BLK" },
  fg3m_total: { en: "Total 3-Pointers Made", zh: "三分总命中数", abbr: "3PM" }, dd2: { en: "Double-Doubles", zh: "两双", abbr: "DD2" },
  td3: { en: "Triple-Doubles", zh: "三双", abbr: "TD3" }, per: { en: "Player Efficiency Rating", zh: "PER效率值", abbr: "PER" },
  nba_rating: { en: "NBA Rating", zh: "NBA评分", abbr: "RAT" }, usage_rate: { en: "Usage Rate", zh: "球权使用率", abbr: "USG%" },
  vorp: { en: "Value Over Replacement", zh: "VORP", abbr: "VORP" }, ast_to: { en: "Assist/Turnover", zh: "助攻失误比", abbr: "AST/TO" },
  stl_to: { en: "Steal/Turnover", zh: "抢断失误比", abbr: "STL/TO" }, reb_rate: { en: "Rebound Rate", zh: "篮板率", abbr: "REB%" },
  pts_per_poss: { en: "Points per Possession", zh: "每回合得分", abbr: "PPP" }, plus_minus: { en: "Plus/Minus", zh: "正负值", abbr: "+/-" },
  fast_break_pts: { en: "Fast Break Points", zh: "快攻得分", abbr: "FBP" }, pts_in_paint: { en: "Points in Paint", zh: "内线得分", abbr: "PIP" },
  turnover_pts: { en: "Points off Turnovers", zh: "利用失误得分", abbr: "POT" }, largest_lead: { en: "Largest Lead", zh: "最大领先", abbr: "LL" },
};
// leader categories: col = column in player_season_stats; kind: per_game | pct | total
export const LEADER_CATS: { key: string; col: string; type: "basic" | "advanced"; kind: "per_game" | "pct" | "total"; attempts?: string }[] = [
  { key: "pts", col: "pts", type: "basic", kind: "per_game" }, { key: "reb", col: "reb", type: "basic", kind: "per_game" },
  { key: "oreb", col: "oreb", type: "basic", kind: "per_game" }, { key: "dreb", col: "dreb", type: "basic", kind: "per_game" },
  { key: "ast", col: "ast", type: "basic", kind: "per_game" }, { key: "stl", col: "stl", type: "basic", kind: "per_game" },
  { key: "blk", col: "blk", type: "basic", kind: "per_game" }, { key: "tov", col: "tov", type: "basic", kind: "per_game" },
  { key: "pf", col: "pf", type: "basic", kind: "per_game" }, { key: "min", col: "min", type: "basic", kind: "per_game" },
  { key: "fg_pct", col: "fg_pct", type: "basic", kind: "pct", attempts: "fga >= 3" }, { key: "fgm", col: "fgm", type: "basic", kind: "per_game" },
  { key: "fg3m_total", col: "fg3m_total", type: "basic", kind: "total" }, { key: "fg3m", col: "fg3m", type: "basic", kind: "per_game" },
  { key: "fg3_pct", col: "fg3_pct", type: "basic", kind: "pct", attempts: "fg3a >= 1" }, { key: "ft_pct", col: "ft_pct", type: "basic", kind: "pct", attempts: "fta >= 1" },
  { key: "ftm", col: "ftm", type: "basic", kind: "per_game" }, { key: "dd2", col: "dd2", type: "basic", kind: "total" },
  { key: "td3", col: "td3", type: "basic", kind: "total" }, { key: "pts_total", col: "pts_total", type: "basic", kind: "total" },
  { key: "per", col: "per", type: "advanced", kind: "per_game" }, { key: "ts_pct", col: "ts_pct", type: "advanced", kind: "pct", attempts: "fga >= 3" },
  { key: "efg_pct", col: "efg_pct", type: "advanced", kind: "pct", attempts: "fga >= 3" }, { key: "nba_rating", col: "nba_rating", type: "advanced", kind: "per_game" },
  { key: "usage_rate", col: "usage_rate", type: "advanced", kind: "per_game" }, { key: "vorp", col: "vorp", type: "advanced", kind: "total" },
  { key: "ast_to", col: "ast_to", type: "advanced", kind: "per_game" }, { key: "stl_to", col: "stl_to", type: "advanced", kind: "per_game" },
  { key: "reb_rate", col: "reb_rate", type: "advanced", kind: "per_game" }, { key: "pts_per_poss", col: "pts_per_poss", type: "advanced", kind: "per_game" },
  { key: "plus_minus", col: "plus_minus", type: "advanced", kind: "per_game" },
];
export const BASIC_AVG = ["gp", "gs", "min", "pts", "reb", "oreb", "dreb", "ast", "stl", "blk", "tov", "pf", "fgm", "fga", "fg3m", "fg3a", "ftm", "fta", "fg_pct", "fg3_pct", "ft_pct", "pts_total", "reb_total", "ast_total", "stl_total", "blk_total", "fg3m_total", "dd2", "td3"];
export const ADV = ["per", "ts_pct", "efg_pct", "nba_rating", "usage_rate", "vorp", "ast_to", "stl_to", "reb_rate", "pts_per_poss", "plus_minus"];
