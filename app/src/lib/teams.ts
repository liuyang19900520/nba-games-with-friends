// Local fallback: Chinese names + primary colors (ESPN abbreviations). API name_zh/color take precedence.
export const TEAMS: Record<string, [string, string, string]> = {
  ATL: ['老鹰', '亚特兰大老鹰', '#C8102E'], BOS: ['凯尔特人', '波士顿凯尔特人', '#007A33'], BKN: ['篮网', '布鲁克林篮网', '#000000'],
  CHA: ['黄蜂', '夏洛特黄蜂', '#1D1160'], CHI: ['公牛', '芝加哥公牛', '#CE1141'], CLE: ['骑士', '克利夫兰骑士', '#860038'],
  DAL: ['独行侠', '达拉斯独行侠', '#00538C'], DEN: ['掘金', '丹佛掘金', '#0E2240'], DET: ['活塞', '底特律活塞', '#C8102E'],
  GS: ['勇士', '金州勇士', '#1D428A'], HOU: ['火箭', '休斯顿火箭', '#CE1141'], IND: ['步行者', '印第安纳步行者', '#002D62'],
  LAC: ['快船', '洛杉矶快船', '#C8102E'], LAL: ['湖人', '洛杉矶湖人', '#552583'], MEM: ['灰熊', '孟菲斯灰熊', '#5D76A9'],
  MIA: ['热火', '迈阿密热火', '#98002E'], MIL: ['雄鹿', '密尔沃基雄鹿', '#00471B'], MIN: ['森林狼', '明尼苏达森林狼', '#0C2340'],
  NO: ['鹈鹕', '新奥尔良鹈鹕', '#0C2340'], NY: ['尼克斯', '纽约尼克斯', '#006BB6'], OKC: ['雷霆', '俄克拉荷马城雷霆', '#007AC1'],
  ORL: ['魔术', '奥兰多魔术', '#0077C0'], PHI: ['76人', '费城76人', '#006BB6'], PHX: ['太阳', '菲尼克斯太阳', '#1D1160'],
  POR: ['开拓者', '波特兰开拓者', '#E03A3E'], SAC: ['国王', '萨克拉门托国王', '#5A2D81'], SA: ['马刺', '圣安东尼奥马刺', '#000000'],
  TOR: ['猛龙', '多伦多猛龙', '#CE1141'], UTAH: ['爵士', '犹他爵士', '#002B5C'], WSH: ['奇才', '华盛顿奇才', '#002B5C'],
}
import { getLang } from './i18n'
export function teamName(tm: any, full = false): string {
  if (!tm) return ''
  const abbr = tm.abbr || tm.team_abbr
  const loc = TEAMS[abbr]
  if (getLang() === 'zh') return (full ? tm.name_zh || loc?.[1] : tm.short_name_zh || loc?.[0] || tm.name_zh) || tm.name || abbr
  return full ? tm.display_name || tm.name || abbr : tm.short_name || tm.name || abbr
}
export function teamColor(tm: any): string {
  const c = tm?.color
  if (c) return c.startsWith('#') ? c : '#' + c
  return TEAMS[tm?.abbr || tm?.team_abbr]?.[2] || '#1D273D'
}
import { asset } from './api'
// own static images (/img/teams/<ABBR>.png bundled into the H5 site; see scripts/localize-images.py)
export const logoOf = (tm: any) => asset(tm?.logo_url || (tm?.abbr ? `/img/teams/${String(tm.abbr).toUpperCase()}.png` : ''))
export const headshotOf = (p: any) => asset(p?.headshot_url)
