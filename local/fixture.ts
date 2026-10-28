// Local-only: load a small REAL fixture from ESPN public JSON into the local PGlite (:5434). Prod data comes from the sync Lambda.
import pg from "pg";
const c = new pg.Client("postgres://postgres@127.0.0.1:5434/postgres"); await c.connect();
import { createHash } from "node:crypto"; import fs from "node:fs";
const J = async (u: string): Promise<any> => {
  const f = "/workspace/work/espn-cache/" + createHash("sha1").update(u).digest("hex") + ".json"; // read-only reuse of nba-sync cache
  if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, "utf8")).body;
  for (let i = 0; i < 5; i++) { const t = await (await fetch(i ? u + (u.includes("?") ? "&" : "?") + "lang=en&region=us&_cb=" + Date.now() : u, { headers: { "user-agent": "Mozilla/5.0", accept: "application/json" } })).text(); if (t.trim()) return JSON.parse(t); await new Promise((r) => setTimeout(r, 2000 * 2 ** i)); }
  throw new Error("empty " + u); };
const B = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba";
const n = (v: any) => (v == null || v === "" || v === "--" ? null : Number.isFinite(+String(v).replace("+", "")) ? Math.round(+String(v).replace("+", "")) : null);
for (const { team: t } of (await J(B + "/teams")).sports[0].leagues[0].teams)
  await c.query("INSERT INTO teams(id,abbr,name,logo_url) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING", [+t.id, t.abbreviation, t.displayName, t.logos?.[0]?.href]);
const teamsPlaying = new Set<string>();
for (const d of (process.argv[2] ?? "20261026,20261027,20261028").split(",")) {
  for (const e of (await J(`${B}/scoreboard?dates=${d}&limit=100`)).events ?? []) {
    const co = e.competitions[0], h = co.competitors.find((x: any) => x.homeAway === "home"), a = co.competitors.find((x: any) => x.homeAway === "away");
    const st = ({ pre: "scheduled", in: "live", post: "final" } as any)[e.status.type.state];
    teamsPlaying.add(h.team.id); teamsPlaying.add(a.team.id);
    await c.query(`INSERT INTO games(id,season,season_type,game_date,tipoff_at,home_team_id,away_team_id,status,period,home_score,away_score,box_complete)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT(id) DO UPDATE SET status=EXCLUDED.status,home_score=EXCLUDED.home_score,away_score=EXCLUDED.away_score,box_complete=EXCLUDED.box_complete`,
      [+e.id, e.season.year, e.season.type, `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}`, e.date, +h.team.id, +a.team.id, st, e.status.period, st === "scheduled" ? null : n(h.score), st === "scheduled" ? null : n(a.score), st === "final"]);
    if (st === "scheduled") continue;
    const s = await J(`${B}/summary?event=${e.id}`);
    for (const tb of s.boxscore?.players ?? []) {
      const keys: string[] = tb.statistics[0].keys;
      for (const ath of tb.statistics[0].athletes) {
        const p = ath.athlete, v: Record<string, any> = Object.fromEntries(keys.map((k, i) => [k, ath.stats?.[i]]));
        const pair = (k: string) => (v[k] ?? "").split("-").map(n);
        const [fgm, fga] = pair("fieldGoalsMade-fieldGoalsAttempted"), [f3m, f3a] = pair("threePointFieldGoalsMade-threePointFieldGoalsAttempted"), [ftm, fta] = pair("freeThrowsMade-freeThrowsAttempted");
        await c.query(`INSERT INTO players(id,full_name,team_id,position,jersey,headshot_url) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING`,
          [+p.id, p.displayName, +tb.team.id, p.position?.abbreviation, p.jersey, p.headshot?.href]);
        await c.query(`INSERT INTO player_game_stats(game_id,player_id,team_id,starter,dnp,dnp_reason,minutes,pts,reb,oreb,dreb,ast,stl,blk,tov,pf,fgm,fga,fg3m,fg3a,ftm,fta,plus_minus)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23) ON CONFLICT DO NOTHING`,
          [+e.id, +p.id, +tb.team.id, !!ath.starter, !!ath.didNotPlay, ath.reason ?? null, n(v.minutes), n(v.points), n(v.rebounds), n(v.offensiveRebounds), n(v.defensiveRebounds), n(v.assists), n(v.steals), n(v.blocks), n(v.turnovers), n(v.fouls), fgm, fga, f3m, f3a, ftm, fta, n(v.plusMinus)]);
      }
    }
  }
}
for (const tid of teamsPlaying) {
  const r = await J(`${B}/teams/${tid}/roster`);
  for (const a of r.athletes ?? []) {
    await c.query(`INSERT INTO players(id,full_name,team_id,position,jersey,headshot_url) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING`, [+a.id, a.fullName, +tid, a.position?.abbreviation, a.jersey, a.headshot?.href]);
    if (a.contract?.salary) await c.query(`INSERT INTO player_salaries(player_id,season,team_id,salary) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING`, [+a.id, r.season?.year ?? 2027, +tid, a.contract.salary]);
  }
}
for (const t of ["games", "player_game_stats", "player_salaries", "players"]) console.log(t, (await c.query(`select count(*) from ${t}`)).rows[0].count);
await c.end();
