// Build compact mock fixtures from a running API (default http://127.0.0.1:8787).
// Output: static/mock/<snapshotPath>.json (same path rule as nba-web/scripts/export-snapshot.ts:
//   /api/v1/<path>?a=1&b=2 -> api/v1/<path>/a/1/b/2.json, query keys sorted). Served at /mock/... by the H5 build.
// Usage: node scripts/build-fixtures.mjs [apiBase]
import fs from 'node:fs'; import path from 'node:path'
const API = process.argv[2] || 'http://127.0.0.1:8787'
const OUT = path.resolve('static/mock')
const SEASON = 2027, ST = 2
// all 30 teams get a full team page; every rostered player gets a (trimmed) player page
// "today" of the mock world (= app TARO_APP_DEFAULT_DATE). Home fetches ?from=&to= ranges relative to it.
const TODAY = process.env.MOCK_TODAY || '2026-10-29'
const addDays = (d, n) => { const t = new Date(d + 'T12:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10) }
const UPCOMING_DAYS = 14, RECENT_DAYS = 7
const DATES = Array.from({ length: 4 }, (_, i) => addDays(TODAY, i - 4)) // single-day pages (date picker) for recent days

const MAX_GAMES = 14, MAX_PLAYS = 160, LEADER_LIMIT = 30
// add short_name ("S. Gilgeous-Alexander") / last_name to player-like objects that lack them (UI rule: lib/names.ts)
const SUF = /^(jr\.?|sr\.?|ii|iii|iv|v)$/i
function names(o) {
  if (o && typeof o === 'object' && typeof o.name === 'string' && ('jersey' in o || 'player_id' in o || 'headshot_url' in o) && !o.abbr) {
    const parts = o.name.trim().split(/\s+/)
    if (parts.length > 1) {
      const suf = SUF.test(parts[parts.length - 1]) ? parts.pop() : ''
      const last = [parts.pop(), suf].filter(Boolean).join(' ')
      o.last_name ??= last; o.short_name ??= `${o.name[0]}. ${last}`
    }
  }
  if (Array.isArray(o)) o.forEach(names); else if (o && typeof o === 'object') Object.values(o).forEach(names)
  return o
}
const withShortNames = (x) => names(x)
export const snapshotPath = (p, q = {}) => [p.replace(/^\/+/, ''), ...Object.keys(q).sort().flatMap((k) => [k, encodeURIComponent(q[k])])].join('/') + '.json'
let bytes = 0, n = 0
async function get(p, q = {}) {
  const u = API + p + (Object.keys(q).length ? '?' + new URLSearchParams(q) : '')
  const r = await fetch(u); if (!r.ok) { console.error('ERR', r.status, u); return null }
  return r.json()
}
function save(p, q, data) {
  const f = path.join(OUT, snapshotPath(p, q)); fs.mkdirSync(path.dirname(f), { recursive: true })
  const s = JSON.stringify(data); fs.writeFileSync(f, s); bytes += s.length; n++
}
async function dump(p, q = {}, trim = (x) => x) { const d = await get(p, q); if (d) save(p, q, trim(d)); return d }
fs.rmSync(OUT, { recursive: true, force: true })
const meta = await dump('/api/v1/meta')
const teams = await dump('/api/v1/teams'); await dump('/api/v1/standings'); await dump('/api/v1/injuries')
const want = new Set()
for (const kind of ['basic', 'advanced']) {
  const all = await dump('/api/v1/leaders', { season: SEASON, season_type: ST, type: kind })
  for (const c of all?.categories || []) {
    if (kind === 'basic') (c.leaders || []).slice(0, 1).forEach((l) => want.add(l.player.id))
    await dump('/api/v1/leaders', { season: SEASON, season_type: ST, category: c.key, limit: LEADER_LIMIT }, withShortNames)
  }
}
const rostered = new Set()
for (const t of teams.teams) {
  const d = await dump(`/api/v1/teams/${t.id}`, {}, withShortNames)
  ;(d?.roster || []).forEach((p, i) => { rostered.add(p.id); if (i < 3) want.add(p.id) })
}
// stars (category #1s + top-3 per roster): full detail; everyone else: drop raw ESPN groups, last 10 games
for (const id of new Set([...want, ...rostered])) await dump(`/api/v1/players/${id}`, {}, (x) => withShortNames(want.has(id) ? x : { ...x, espn_stats: undefined, game_log: (x.game_log || []).slice(0, 10) }))
let games = 0
for (const date of [...DATES].reverse()) {
  const d = await dump('/api/v1/games', { date })
  for (const g of d?.games || []) {
    if (games >= MAX_GAMES) break
    games++
    await dump(`/api/v1/games/${g.id}`, {}, (x0) => { const x = withShortNames(x0)
      const wp = x.win_probability || []; const step = Math.max(1, Math.ceil(wp.length / 100))
      const plays = x.plays || []
      // keep scoring plays first, then fill with others, keep chronological order
      const keep = new Set(plays.filter((p) => p.scoring).slice(-MAX_PLAYS).map((p) => p.id))
      for (const p of plays) { if (keep.size >= MAX_PLAYS) break; keep.add(p.id) }
      return { ...x, plays: plays.filter((p) => keep.has(p.id)), plays_trimmed: plays.length, win_probability: wp.filter((_, i) => i % step === 0) }
    })
  }
}
// Home: upcoming (today .. +13) and recent (-7 .. -1) ranges; single days for the jump-to-date control
const up = await dump('/api/v1/games', { from: TODAY, to: addDays(TODAY, UPCOMING_DAYS - 1) }, withShortNames)
await dump('/api/v1/games', { from: addDays(TODAY, -RECENT_DAYS), to: addDays(TODAY, -1) }, withShortNames)
for (let i = 0; i < UPCOMING_DAYS; i++) await dump('/api/v1/games', { date: addDays(TODAY, i) })
// pre-game detail pages for the next 3 days (small: no box/plays yet)
for (const g of (up?.games || []).filter((g) => g.date <= addDays(TODAY, 2))) await dump(`/api/v1/games/${g.id}`, {}, withShortNames)
// Lineup picker: all active players with season averages + salary
await dump('/api/v1/players', { limit: 600 }, withShortNames)
// Team stat rankings (PROPOSED endpoint /api/v1/stats/teams — FRONTEND-REQUESTS #9); derived here from /teams/:id from_box_scores
const TEAM_CATS = [['pts', '得分', 'Points'], ['reb', '篮板', 'Rebounds'], ['ast', '助攻', 'Assists'], ['stl', '抢断', 'Steals'], ['blk', '盖帽', 'Blocks'],
  ['tov', '失误', 'Turnovers', 'asc'], ['fg_pct', '投篮命中率', 'FG%'], ['fg3_pct', '三分命中率', '3P%'], ['ft_pct', '罚球命中率', 'FT%'], ['oreb', '前场篮板', 'Off reb'],
  ['pts_in_paint', '内线得分', 'Paint pts'], ['fast_break_pts', '快攻得分', 'Fast break'], ['opp_pts', '失分', 'Opp pts', 'asc']]
const tstats = []
for (const t of teams.teams) {
  const d = JSON.parse(fs.readFileSync(path.join(OUT, snapshotPath(`/api/v1/teams/${t.id}`)), 'utf8'))
  const f = d.team_stats?.from_box_scores || {}
  tstats.push({ team: { id: t.id, abbr: t.abbr, name: t.name, name_zh: t.name_zh, short_name_zh: t.short_name_zh, logo_url: t.logo_url }, gp: f.gp, ...f, opp_pts: d.team?.record?.overall?.avgPointsAgainst })
}
const categories = TEAM_CATS.map(([key, zh, en, order]) => {
  const rows = tstats.filter((x) => x[key] != null).sort((a, b) => (order === 'asc' ? a[key] - b[key] : b[key] - a[key]))
  let rank = 0, prev
  return { key, zh, en, order: order || 'desc', teams: rows.map((x, i) => { if (x[key] !== prev) rank = i + 1; prev = x[key]; return { rank, team: x.team, value: x[key], gp: x.gp } }) }
})
save('/api/v1/stats/teams', { season: SEASON }, { season: SEASON, season_type: ST, source: 'derived from box scores (mock)', categories })
fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify({ generated_from: API, today: TODAY, dates: DATES, files: n, bytes }))
console.log(`fixtures: ${n} files, ${(bytes / 1024).toFixed(0)} KB, stars=${want.size}, players=${new Set([...want, ...rostered]).size}, games=${games}`)
