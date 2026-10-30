// Thin JSON API client. Two transport modes (config TARO_APP_API_MODE):
//  - "request": Taro.request -> TARO_APP_API_BASE (H5 + mini program with a legal ICP-filed request domain)
//  - "cloud":   wx.cloud.callFunction({name:'api', data:{path}}) proxy (mini program w/o ICP domain)
//  - "mock":    bundled fake data = static JSON fixtures at <STATIC_BASE>/mock/<snapshotPath>.json (no backend)
//               H5: same origin (lazy-loaded per path). weapp: fetched from the deployed H5 site (2MB package limit).
// Cache: in-memory + Taro storage (stale-while-revalidate-ish TTL).
import Taro from '@tarojs/taro'

const BASE = (process.env.TARO_APP_API_BASE || '').replace(/\/$/, '')
const MODE = process.env.TARO_APP_API_MODE || 'request'
const mem = new Map<string, { t: number; v: any }>()
let cloudInited = false
/** where /mock and /img live: same origin for H5, the deployed H5 site for the mini program */
export const STATIC_BASE = (process.env.TARO_APP_STATIC_BASE || (process.env.TARO_ENV === 'h5' ? '' : 'https://nba-v2.vercel.app')).replace(/\/$/, '')
export const asset = (u?: string | null) => (u && u.startsWith('/') ? STATIC_BASE + u : u || '')
export const IS_MOCK = MODE === 'mock'
/** same rule as nba-web/scripts/export-snapshot.ts */
export function snapshotPath(path: string) {
  const [p, qs = ''] = path.split('?')
  const q = URLSearchParamsLite(qs)
  return [p.replace(/^\/+/, ''), ...Object.keys(q).sort().flatMap((k) => [k, encodeURIComponent(q[k])])].join('/') + '.json'
}
function URLSearchParamsLite(qs: string): any {
  const o: Record<string, string> = {}
  qs.split('&').filter(Boolean).forEach((kv) => { const [k, v = ''] = kv.split('='); o[decodeURIComponent(k)] = decodeURIComponent(v) })
  return o
}

export class ApiError extends Error { constructor(public status: number, msg: string) { super(msg) } }

async function transport(path: string): Promise<any> {
  if (MODE === 'mock') {
    const r = await Taro.request({ url: `${STATIC_BASE}/mock/${snapshotPath(path)}`, method: 'GET', timeout: 15000 })
    if (r.statusCode >= 400 || typeof r.data !== 'object') throw new ApiError(404, '演示数据中没有该内容 (not in mock data)')
    return r.data
  }
  if (MODE === 'cloud' && process.env.TARO_ENV === 'weapp') {
    if (!cloudInited) { wx.cloud.init({ env: process.env.TARO_APP_CLOUD_ENV || undefined }); cloudInited = true }
    const r: any = await wx.cloud.callFunction({ name: 'api', data: { path } })
    const res = r.result || {}
    if (res.status && res.status >= 400) throw new ApiError(res.status, res.body?.error?.message || 'error')
    return res.body ?? res
  }
  const r = await Taro.request({ url: BASE + path, method: 'GET', timeout: 15000 })
  if (r.statusCode >= 400) throw new ApiError(r.statusCode, (r.data as any)?.error?.message || `HTTP ${r.statusCode}`)
  return r.data
}

/** GET with cache. ttl seconds (default 60). */
export async function get<T = any>(path: string, ttl = 60): Promise<T> {
  const now = Date.now()
  const m = mem.get(path)
  if (m && now - m.t < ttl * 1000) return m.v
  if (!m) {
    try {
      const s = Taro.getStorageSync('api:' + path)
      if (s && now - s.t < ttl * 1000) { mem.set(path, s); return s.v }
    } catch (e) { /* ignore */ }
  }
  const v = await transport(path)
  const entry = { t: now, v }
  mem.set(path, entry)
  try { Taro.setStorageSync('api:' + path, entry) } catch (e) { /* quota: ignore */ }
  return v
}

export const api = {
  meta: () => get('/api/v1/meta', 3600),
  games: (date: string) => get(`/api/v1/games?date=${date}`, 30),
  gamesRange: (from: string, to: string) => get(`/api/v1/games?from=${from}&to=${to}`, 60),
  teamStats: (season: number) => get(`/api/v1/stats/teams?season=${season}`, 600),
  allPlayers: () => get('/api/v1/players?limit=600', 3600),
  game: (id: string) => get(`/api/v1/games/${id}`, 30),
  teams: () => get('/api/v1/teams', 600),
  team: (id: string) => get(`/api/v1/teams/${id}`, 300),
  standings: (season?: number) => get(`/api/v1/standings${season ? `?season=${season}` : ''}`, 300),
  players: (qs: string) => get(`/api/v1/players?${qs}`, 600),
  player: (id: string, season?: number, type?: number) => get(`/api/v1/players/${id}${season ? `?season=${season}&season_type=${type || 2}` : ''}`, 120),
  gamelog: (id: string, season: number, type: number) => get(`/api/v1/players/${id}/gamelog?season=${season}&season_type=${type}`, 120),
  leadersAll: (season: number, type: number, kind: string) => get(`/api/v1/leaders?season=${season}&season_type=${type}&type=${kind}`, 300),
  leaders: (season: number, type: number, category: string, limit = 30) => get(`/api/v1/leaders?season=${season}&season_type=${type}&category=${category}&limit=${limit}`, 300),
  injuries: () => get('/api/v1/injuries', 300),
}
