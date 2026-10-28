// Static JSON snapshot export: calls the SAME route() handler for every endpoint and writes the response bodies to files,
// so the data can be served from Tencent COS / CloudBase static hosting / any CDN when proxying the live API isn't possible.
// Usage: DATABASE_URL=... npx tsx scripts/export-snapshot.ts [--out=./snapshot] [--season=2027] [--days=all|14] [--players=all|active]
// Path rule (also written to index.json): /api/v1/<path>?<k=v&...>  ->  <out>/api/v1/<path>[/<k>/<v>...].json  (query keys sorted)
//   e.g. /api/v1/games?date=2026-10-27 -> api/v1/games/date/2026-10-27.json ; /api/v1/leaders?category=pts -> api/v1/leaders/category/pts.json
import fs from "node:fs"; import path from "node:path";
import { route } from "../api/handlers.ts";
import { q, db } from "../api/db.ts";
import { LEADER_CATS } from "../api/i18n.ts";

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, "").split("="); return [k, v ?? "1"]; }));
const OUT = path.resolve(args.out ?? "snapshot");
export function snapshotPath(p: string, query: Record<string, string> = {}) {
  const parts = Object.keys(query).sort().flatMap((k) => [k, encodeURIComponent(query[k])]);
  return [p.replace(/^\/+/, ""), ...parts].join("/") + ".json";
}
const files: string[] = []; let bytes = 0, errors = 0;
async function dump(p: string, query: Record<string, string> = {}) {
  const r = await route({ method: "GET", path: p, query });
  if (r.status !== 200) { errors++; console.error("ERR", r.status, p, query, r.body.slice(0, 200)); return null; }
  const rel = snapshotPath(p, query); const f = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, r.body);
  files.push(rel); bytes += r.body.length; return JSON.parse(r.body);
}
const t0 = Date.now();
const meta = await dump("/api/v1/meta");
const season = Number(args.season ?? meta.current_season);
const sq = (x: Record<string, string> = {}) => (args.season ? { season: String(season), ...x } : x);
await dump("/api/v1/teams", sq()); await dump("/api/v1/standings", sq()); await dump("/api/v1/injuries");
for (const t of await q(`SELECT id FROM teams ORDER BY id`)) { await dump(`/api/v1/teams/${t.id}`, sq()); await dump("/api/v1/games", { team: String(t.id), ...(args.season ? { season: String(season) } : {}) }); }
for (const type of ["basic", "advanced"]) await dump("/api/v1/leaders", sq({ type }));
await dump("/api/v1/leaders", sq());
for (const st of ["2"]) for (const c of LEADER_CATS) await dump("/api/v1/leaders", sq({ category: c.key, ...(st !== "2" ? { season_type: st } : {}) }));
await dump("/api/v1/players", { limit: "600" });
await dump("/api/v1/players", { limit: "600", active: "0" });
const players = await q(args.players === "all" ? `SELECT id FROM players ORDER BY id` : `SELECT id FROM players WHERE is_active OR id IN (SELECT player_id FROM player_season_stats WHERE season=$1) ORDER BY id`, args.players === "all" ? [] : [season]);
for (const p of players) await dump(`/api/v1/players/${p.id}`, sq());
const days = await q(`SELECT DISTINCT game_date::text d FROM games WHERE season=$1 ${args.days && args.days !== "all" ? `AND game_date >= (now() at time zone 'America/New_York')::date - ${Number(args.days)}` : ""} ORDER BY 1`, [season]);
for (const d of days) await dump("/api/v1/games", { date: d.d });
await dump("/api/v1/games", {}); // today
for (const g of await q(`SELECT id FROM games WHERE season=$1 AND status IN ('final','live') ORDER BY id`, [season])) await dump(`/api/v1/games/${g.id}`);
fs.writeFileSync(path.join(OUT, "index.json"), JSON.stringify({ generated_at: new Date().toISOString(), season,
  rules: { path: "/api/v1/<path>?k=v&k2=v2 -> api/v1/<path>/k/v/k2/v2.json (query keys sorted asc, values URI-encoded; no query -> <path>.json)",
    note: "date-less /api/v1/games.json = ET 'today' at export time; season param omitted = current season" },
  count: files.length, bytes, files }, null, 0));
console.log(JSON.stringify({ out: OUT, files: files.length, mb: +(bytes / 1048576).toFixed(1), errors, sec: (Date.now() - t0) / 1000 }));
await db().end();
