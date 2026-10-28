import Taro from '@tarojs/taro'
import { useEffect, useState } from 'react'
export type Lang = 'zh' | 'en'
const D: Record<string, [string, string]> = {
  schedule: ['赛程', 'Games'], standings: ['球队榜', 'Standings'], leaders: ['球员榜', 'Leaders'], more: ['我的', 'Profile'],
  today: ['今天', 'Today'], noGames: ['当天没有比赛', 'No games on this day'], loading: ['加载中…', 'Loading…'],
  error: ['加载失败', 'Failed to load'], retry: ['重试', 'Retry'], empty: ['暂无数据', 'No data'],
  final: ['已结束', 'Final'], live: ['进行中', 'Live'], scheduled: ['未开始', 'Scheduled'],
  east: ['东部', 'East'], west: ['西部', 'West'], team: ['球队', 'Team'], value: ['数据', 'Value'],
  viewAll: ['查看全部', 'View all'], basic: ['基础', 'Basic'], advanced: ['进阶', 'Advanced'],
  regular: ['常规赛', 'Regular'], preseason: ['季前赛', 'Preseason'], postseason: ['季后赛', 'Playoffs'],
  players: ['球员', 'Roster'], stats: ['数据', 'Stats'], salary: ['薪资', 'Salary'], info: ['资料', 'Info'],
  games: ['比赛', 'Games'], boxscore: ['数据', 'Box'], compare: ['球队对比', 'Team stats'], pbp: ['过程', 'Plays'],
  starters: ['首发', 'Starters'], bench: ['替补', 'Bench'], dnp: ['未上场', 'DNP'], rank: ['排名', 'Rank'],
  wl: ['胜/负', 'W/L'], home: ['主场', 'Home'], away: ['客场', 'Away'], venue: ['球馆', 'Venue'],
  leagueRank: ['联盟第', 'Rank #'], career: ['生涯/历史赛季', 'Career / seasons'], basicStats: ['基础数据', 'Basic stats'],
  advStats: ['进阶数据', 'Advanced stats'], coaches: ['教练组', 'Coaches'], lang: ['English', '中文'],
  season: ['赛季', 'Season'], age: ['年龄', 'Age'], height: ['身高', 'Height'], weight: ['体重', 'Weight'],
  birthplace: ['出生地', 'Birthplace'], college: ['大学', 'College'], draft: ['选秀', 'Draft'], injury: ['伤病', 'Injury'],
  notAvailable: ['接口暂未提供该数据', 'Not provided by API yet'], attendance: ['观众', 'Attendance'],
  officials: ['裁判', 'Officials'], broadcast: ['转播', 'Broadcast'], odds: ['赔率', 'Odds'], injuries: ['伤病', 'Injuries'],
  winprob: ['胜率走势', 'Win probability'], allTeams: ['全部球队', 'All teams'], settings: ['设置', 'Settings'],
  language: ['语言', 'Language'], apiBase: ['API 地址', 'API base'], about: ['数据来源：ESPN', 'Data: ESPN'],
}
const KEY = 'lang'
function detect(): Lang {
  try { const s = Taro.getStorageSync(KEY); if (s === 'zh' || s === 'en') return s } catch (e) {}
  if (process.env.TARO_ENV === 'h5') {
    const n = (typeof navigator !== 'undefined' && navigator.language) || 'zh'
    return n.toLowerCase().startsWith('zh') ? 'zh' : 'en'
  }
  return 'zh' // mini program: Chinese default
}
let cur: Lang = detect()
const subs = new Set<(l: Lang) => void>()
export const getLang = () => cur
export function setLang(l: Lang) { cur = l; Taro.setStorageSync(KEY, l); subs.forEach((f) => f(l)) }
export const t = (k: string) => (D[k] ? D[k][cur === 'zh' ? 0 : 1] : k)
export function useLang() {
  const [l, set] = useState(cur)
  useEffect(() => { subs.add(set); return () => { subs.delete(set) } }, [])
  return l
}
