// ESPN -> Postgres sync (v2b: "store everything structured").
// Usage: DATABASE_URL=... npx tsx src/sync.ts [--full] [--from=2026-10-02] [--dates=20261025,...] [--days-back=3] [--ahead=1]
//        [--season=2027] [--prev-season=2026] [--no-core] [--no-bios] [--reprocess]
// full  : teams+venues+coaches, rosters(bio, salary), standings, injuries, team stats, core bios (draft), all games from --from to today
//         (scoreboard + summary: box, periods, team stats, officials, broadcasts, odds, plays, win prob, leaders, injuries),
//         ESPN core season stats (incl. advanced) for every player for --season and --prev-season.
// daily : last N days + today/tomorrow scoreboards & summaries, rosters, standings, injuries, core stats for players who played.
import pg from "pg";
import * as OpenCC from "opencc-js";
import { getJson, getJsonOpt, urls, stats, Fetched } from "./espn.ts";

const parseArgs = (argv: string[]) => Object.fromEntries(argv.map((a) => { const [k, v] = a.replace(/^--/, "").split("="); return [k, v ?? "1"]; }));
let args: Record<string, string> = {};
let db: pg.Client;
const DAY = 86400, WEEK = 7 * DAY;
let SEASON = 2027, PREV = 2026;

const etDate = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(d);
const ymd = (s: string) => s.replaceAll("-", "");
const addDays = (s: string, n: number) => { const d = new Date(s + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const num = (v: any) => { if (v === undefined || v === null || v === "" || v === "--" || v === "-") return null; const n = Number(String(v).replace("+", "")); return Number.isFinite(n) ? n : null; };
const int = (v: any) => { const n = num(v); return n === null ? null : Math.round(n); };
const nz = (v: any) => { const n = num(v); return n === 0 ? null : n; }; // ESPN returns 0 for stats it doesn't compute (usage, VORP, rates)
const ma = (v: any): [number | null, number | null] => { const m = /^(\d+)-(\d+)$/.exec(String(v ?? "")); return m ? [+m[1], +m[2]] : [null, null]; };
const posGroup = (p?: string) => (!p ? null : p.includes("C") ? "C" : p.includes("F") ? "F" : p.includes("G") ? "G" : null);
const r1 = (v: number | null) => (v === null ? null : Math.round(v * 10) / 10);
function gameStatus(st: any) {
  const n = st?.type?.name ?? "";
  if (n.includes("POSTPONED")) return "postponed";
  if (n.includes("CANCELED") || n.includes("CANCELLED")) return "canceled";
  return ({ pre: "scheduled", in: "live", post: "final" } as any)[st?.type?.state] ?? "scheduled";
}
const counts: Record<string, number> = {};
const bump = (k: string, n = 1) => (counts[k] = (counts[k] ?? 0) + n);

const PG_ARRAY_COLS = new Set(["broadcast_names"]); // every other object/array value is jsonb
/** idempotent upsert: no-op (no row write, no updated_at bump) when nothing changed */
async function upsert(table: string, pk: string[], row: Record<string, any>) {
  const cols = Object.keys(row); const vals = cols.map((c) => row[c]);
  const upd = cols.filter((c) => !pk.includes(c));
  const sql = `INSERT INTO ${table} (${cols.join(",")}) VALUES (${cols.map((_, i) => "$" + (i + 1)).join(",")})
    ON CONFLICT (${pk.join(",")}) DO ${upd.length ? `UPDATE SET ${upd.map((c) => `${c}=EXCLUDED.${c}`).join(",")}
    WHERE (${upd.map((c) => `${table}.${c}`).join(",")}) IS DISTINCT FROM (${upd.map((c) => `EXCLUDED.${c}`).join(",")})` : "NOTHING"}`;
  const r = await db.query(sql, vals.map((v, i) => (v !== null && typeof v === "object" && !(v instanceof Date) && !PG_ARRAY_COLS.has(cols[i]) ? JSON.stringify(v) : v)));
  if (r.rowCount) bump("write:" + table, r.rowCount);
}
/** replace child rows of one parent; skipped when content identical */
async function replaceChildren(table: string, where: string, key: any[], recordDef: string, rows: any[]) {
  const sel = (src: string) => `SELECT md5(coalesce(json_agg(t ORDER BY t::text)::text,'')) h FROM (${src}) t`;
  const cols = recordDef.split(",").map((c) => c.trim().split(" ")[0]).join(",");
  const cur = await db.query(sel(`SELECT ${cols} FROM ${table} WHERE ${where}`), key);
  const next = await db.query(sel(`SELECT ${cols} FROM jsonb_to_recordset($1::jsonb) AS x(${recordDef})`), [JSON.stringify(rows)]);
  if (cur.rows[0].h === next.rows[0].h) return;
  await db.query(`DELETE FROM ${table} WHERE ${where}`, key);
  if (rows.length) await db.query(`INSERT INTO ${table} SELECT ${key.map((_, i) => `$${i + 1}`).join(",")}, x.* FROM jsonb_to_recordset($${key.length + 1}::jsonb) AS x(${recordDef})`, [...key, JSON.stringify(rows)]);
  bump("write:" + table, rows.length);
}

let runId: number, todayEt: string;
async function raw(endpoint: string, key: string, f: Fetched): Promise<{ id: number; isNew: boolean }> {
  const r = await db.query(
    `INSERT INTO espn_raw (job_id, endpoint, resource_key, url, fetched_at, http_status, sha256, payload, processed_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8, now())
     ON CONFLICT (endpoint, resource_key, sha256) DO UPDATE SET fetched_at = GREATEST(espn_raw.fetched_at, EXCLUDED.fetched_at)
     RETURNING id, (xmax = 0) AS inserted`, [runId, endpoint, key, f.url, f.fetchedAt, f.httpStatus, f.sha256, f.body]);
  return { id: Number(r.rows[0].id), isNew: r.rows[0].inserted };
}

async function venue(v: any) {
  if (!v?.id) return null;
  // team & game payloads carry different subsets -> merge non-null fields only (keeps re-runs write-free)
  const r = await db.query(`INSERT INTO venues (id, name, short_name, city, state, country, capacity, indoor, image_url)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,
      short_name=coalesce(EXCLUDED.short_name, venues.short_name), city=coalesce(EXCLUDED.city, venues.city), state=coalesce(EXCLUDED.state, venues.state),
      country=coalesce(EXCLUDED.country, venues.country), capacity=coalesce(EXCLUDED.capacity, venues.capacity), indoor=coalesce(EXCLUDED.indoor, venues.indoor),
      image_url=coalesce(EXCLUDED.image_url, venues.image_url)
    WHERE (venues.name, venues.short_name, venues.city, venues.state, venues.country, venues.capacity, venues.indoor, venues.image_url) IS DISTINCT FROM
      (EXCLUDED.name, coalesce(EXCLUDED.short_name, venues.short_name), coalesce(EXCLUDED.city, venues.city), coalesce(EXCLUDED.state, venues.state),
       coalesce(EXCLUDED.country, venues.country), coalesce(EXCLUDED.capacity, venues.capacity), coalesce(EXCLUDED.indoor, venues.indoor), coalesce(EXCLUDED.image_url, venues.image_url))`,
    [+v.id, v.fullName ?? v.name, v.shortName ?? null, v.address?.city ?? null, v.address?.state ?? null, v.address?.country ?? null,
     v.capacity ?? null, v.indoor ?? null, v.images?.[0]?.href ?? null]);
  if (r.rowCount) bump("write:venues", r.rowCount);
  return +v.id;
}

// ---------- teams / rosters ----------
async function syncTeams() {
  const f = await getJson(urls.teams(), DAY);
  await raw("teams", "all", f);
  const ids: string[] = [];
  for (const { team: t0 } of f.body.sports[0].leagues[0].teams) {
    const d = await getJson(urls.team(t0.id), DAY);
    const t = d.body.team;
    const venueId = await venue(t.franchise?.venue);
    const logo = (rel: string) => t.logos?.find((l: any) => l.rel?.includes(rel))?.href ?? null;
    await upsert("teams", ["id"], { id: +t.id, abbr: t.abbreviation, name: t.displayName,
      name_zh: (await db.query(`SELECT name_zh FROM team_i18n WHERE team_id=$1`, [+t.id])).rows[0]?.name_zh ?? null,
      short_name: t.shortDisplayName, location: t.location, nickname: t.name, slug: t.slug,
      color: t.color ? "#" + t.color : null, alt_color: t.alternateColor ? "#" + t.alternateColor : null,
      logo_url: logo("default") ?? t.logos?.[0]?.href ?? null, logo_dark_url: logo("dark"), venue_id: venueId,
      standing_summary: t.standingSummary ?? null, record: t.record?.items ?? null,
      raw: { groups: t.groups, nextEvent: t.nextEvent?.[0]?.id ?? null, links: t.links?.map((l: any) => l.href) } });
    ids.push(t.id);
  }
  return ids;
}

async function syncRoster(teamId: string) {
  const f = await getJson(urls.roster(teamId), DAY / 2);
  await raw("roster", teamId, f);
  for (const c of f.body.coach ?? [])
    await upsert("coaches", ["team_id", "season", "id"], { id: +c.id, team_id: +teamId, season: SEASON, first_name: c.firstName, last_name: c.lastName, role: "Head Coach", experience: c.experience ?? null });
  const seen: number[] = [];
  for (const a of f.body.athletes ?? []) {
    const pos = a.position?.abbreviation ?? null;
    seen.push(+a.id);
    const { links, headshot, contracts, contract, alternateIds, guid, uid, ...bio } = a;
    await upsert("players", ["id"], { id: +a.id, full_name: a.fullName, first_name: a.firstName ?? null, last_name: a.lastName ?? null,
      short_name: a.shortName ?? null, slug: a.slug ?? null, team_id: +teamId, position: pos, position_name: a.position?.name ?? null,
      pos_group: posGroup(pos), jersey: a.jersey ?? null, headshot_url: a.headshot?.href ?? null, is_active: true,
      height_in: a.height ?? null, display_height: a.displayHeight ?? null, weight_lb: a.weight ?? null, display_weight: a.displayWeight ?? null,
      birth_date: a.dateOfBirth ? a.dateOfBirth.slice(0, 10) : null, age: a.age ?? null,
      birth_city: a.birthPlace?.city ?? null, birth_state: a.birthPlace?.state ?? null, birth_country: a.birthPlace?.country ?? null,
      college: a.college?.name ?? null, college_id: a.college?.id ? +a.college.id : null, experience_years: a.experience?.years ?? null,
      status: a.status?.name ?? null, injury_status: a.injuries?.[0]?.status ?? null, bio_raw: bio });
    await db.query(`WITH cur AS (SELECT team_id FROM player_team_history WHERE player_id=$1 AND valid_to IS NULL)
      , closed AS (UPDATE player_team_history SET valid_to=$3 WHERE player_id=$1 AND valid_to IS NULL AND team_id<>$2 RETURNING 1)
      INSERT INTO player_team_history (player_id, team_id, valid_from)
      SELECT $1,$2,$3 WHERE NOT EXISTS (SELECT 1 FROM cur WHERE team_id=$2)
      ON CONFLICT (player_id, valid_from) DO UPDATE SET team_id=EXCLUDED.team_id, valid_to=NULL`, [+a.id, +teamId, todayEt]);
    const cs = [...(contract ? [{ ...contract, season: contract.season ?? { year: SEASON } }] : []), ...(contracts ?? [])];
    for (const c of cs) {
      if (!c?.salary || !c?.season?.year) continue;
      await upsert("player_salaries", ["player_id", "season", "source"], { player_id: +a.id, season: c.season.year,
        team_id: c.season.year === SEASON ? +teamId : null, salary: Math.round(c.salary), source: "espn" });
    }
  }
  const r = await db.query(`UPDATE players SET is_active=false WHERE team_id=$1 AND is_active AND NOT (id = ANY($2::bigint[]))`, [+teamId, seen]);
  bump("players_deactivated", r.rowCount ?? 0);
  return seen.length;
}

// core athlete: draft + debut year (not in roster payload)
async function syncBio(pid: number) {
  const f = await getJsonOpt(urls.coreAthlete(pid), WEEK);
  if (!f) return;
  const a = f.body, d = a.draft;
  const dt = d?.team?.$ref ? +(/teams\/(\d+)/.exec(d.team.$ref)?.[1] ?? 0) || null : null;
  await db.query(`UPDATE players SET draft_year=$2, draft_round=$3, draft_pick=$4, draft_team_id=$5, draft_display=$6, debut_year=$7
    WHERE id=$1 AND (draft_year, draft_round, draft_pick, draft_team_id, draft_display, debut_year) IS DISTINCT FROM ($2::int,$3::int,$4::int,$5::int,$6::text,$7::int)`,
    [pid, d?.year ?? null, d?.round ?? null, d?.selection ?? null, dt, d?.displayText ?? null, a.debutYear ?? null]);
  bump("bios_checked");
}

// Chinese player names: Wikidata items with "ESPN.com NBA player ID" (P3685), label zh-cn > zh-hans > zh. One request, cached 7 days.
async function syncZhNames() {
  const sparql = `SELECT ?espn ?zhcn ?zhhans ?zh WHERE { ?p wdt:P3685 ?espn .
    OPTIONAL{?p rdfs:label ?zhcn FILTER(lang(?zhcn)="zh-cn")} OPTIONAL{?p rdfs:label ?zhhans FILTER(lang(?zhhans)="zh-hans")}
    OPTIONAL{?p rdfs:label ?zh FILTER(lang(?zh)="zh")} }`;
  const f = await getJsonOpt("https://query.wikidata.org/sparql?format=json&query=" + encodeURIComponent(sparql), WEEK);
  if (!f) return 0;
  const toCn = OpenCC.Converter({ from: "tw", to: "cn" }); // plain "zh" labels are often Traditional
  const rows = (f.body.results?.bindings ?? []).map((b: any) => ({ id: Number(b.espn.value), zh: (b.zhcn ?? b.zhhans)?.value ?? (b.zh ? toCn(b.zh.value) : null) }))
    .filter((x: any) => Number.isFinite(x.id) && x.zh && /[\u4e00-\u9fff]/.test(x.zh));
  const r = await db.query(`UPDATE players p SET name_zh=x.zh FROM (SELECT DISTINCT ON (id) id, zh FROM jsonb_to_recordset($1::jsonb) AS x(id bigint, zh text) ORDER BY id) x
    WHERE p.id=x.id AND p.name_zh IS DISTINCT FROM x.zh`, [JSON.stringify(rows)]);
  bump("write:players.name_zh", r.rowCount ?? 0);
  return rows.length;
}

// ---------- standings / injuries / team stats ----------
async function syncStandings(season: number) {
  const f = await getJson(urls.standings(season), 3600);
  await raw("standings", String(season), f);
  for (const conf of f.body.children ?? []) {
    const entries = conf.standings?.entries ?? [];
    const sv = (e: any, n: string) => e.stats.find((s: any) => s.name === n || s.type === n || s.displayName === n);
    const sorted = [...entries].sort((a, b) => (num(sv(a, "playoffSeed")?.value) ?? 99) - (num(sv(b, "playoffSeed")?.value) ?? 99));
    let i = 0;
    for (const e of sorted) {
      i++;
      const all = Object.fromEntries(e.stats.map((s: any) => [s.name ?? s.type, s.displayValue ?? s.summary ?? s.value]));
      const disp = (n: string) => sv(e, n)?.displayValue ?? sv(e, n)?.summary ?? null;
      await upsert("standings", ["season", "team_id"], { season, team_id: +e.team.id, conference: conf.abbreviation,
        conf_rank: i, seed: int(sv(e, "playoffSeed")?.value), wins: int(sv(e, "wins")?.value), losses: int(sv(e, "losses")?.value),
        win_pct: num(sv(e, "winPercent")?.value), games_behind: num(sv(e, "gamesBehind")?.value) ?? 0,
        home: disp("Home"), road: disp("Road"), vs_div: disp("vs. Div."), vs_conf: disp("vs. Conf."), last10: disp("Last Ten Games"),
        streak: disp("streak"), ppg: num(sv(e, "avgPointsFor")?.value), opp_ppg: num(sv(e, "avgPointsAgainst")?.value),
        diff: num(sv(e, "differential")?.value), clincher: disp("clincher"), stats: all });
    }
  }
}

async function syncInjuries() {
  const f = await getJson(urls.injuries(), 1800);
  await raw("injuries", "all", f);
  const ids: number[] = [];
  for (const t of f.body.injuries ?? [])
    for (const i of t.injuries ?? []) {
      const pid = int(/id\/(\d+)/.exec(i.athlete?.links?.[0]?.href ?? "")?.[1]) ?? int(i.athlete?.id);
      if (!pid || ids.includes(+i.id)) continue;
      ids.push(+i.id);
      await upsert("injuries", ["id"], { id: +i.id, player_id: pid, team_id: int(t.id), status: i.status ?? null, date: i.date ?? null,
        type: i.details?.type ?? i.type?.description ?? null, detail: i.details?.detail ?? null, side: i.details?.side ?? null,
        return_date: i.details?.returnDate ?? null, short_comment: i.shortComment ?? null, long_comment: i.longComment ?? null,
        raw: { type: i.type, details: i.details, athlete: { displayName: i.athlete?.displayName, position: i.athlete?.position?.abbreviation, headshot: i.athlete?.headshot?.href } } });
    }
  const r = await db.query(`DELETE FROM injuries WHERE NOT (id = ANY($1::bigint[]))`, [ids]);
  bump("injuries_cleared", r.rowCount ?? 0);
  return ids.length;
}

function flattenCats(cats: any[]) {
  const out: Record<string, any> = {};
  for (const c of cats ?? []) for (const s of c.stats ?? []) out[`${c.name}.${s.name}`] = { v: s.value ?? null, d: s.displayValue ?? null, rank: s.rank ?? null };
  return out;
}
async function syncTeamStats(teamId: string, season: number) {
  const f = await getJsonOpt(urls.teamStats(teamId, season), 6 * 3600);
  if (!f) return;
  const st = flattenCats(f.body.results?.stats?.categories);
  await upsert("team_season_stats", ["team_id", "season", "season_type"], { team_id: +teamId, season, season_type: 2,
    gp: int(st["general.gamesPlayed"]?.v), stats: st });
}

// ---------- core season stats per player ----------
async function syncCoreStats(pid: number, season: number, type: number, ttl: number) {
  const f = await getJsonOpt(urls.coreStats(pid, season, type), ttl);
  if (!f) return false;
  const st = flattenCats(f.body.splits?.categories);
  const v = (k: string) => num(st[k]?.v);
  const gp = int(v("general.gamesPlayed"));
  if (!gp) return false;
  const tot = (k: string) => int(v(k));
  await upsert("player_season_stats_espn", ["player_id", "season", "season_type"], {
    player_id: pid, season, season_type: type,
    team_id: season === SEASON ? (await db.query(`SELECT team_id FROM players WHERE id=$1`, [pid])).rows[0]?.team_id ?? null : null,
    gp, gs: tot("general.gamesStarted"), min: r1(v("general.avgMinutes")), pts: r1(v("offensive.avgPoints")),
    reb: r1(v("general.avgRebounds")), oreb: r1(v("offensive.avgOffensiveRebounds")), dreb: r1(v("defensive.avgDefensiveRebounds")),
    ast: r1(v("offensive.avgAssists")), stl: r1(v("defensive.avgSteals")), blk: r1(v("defensive.avgBlocks")),
    tov: r1(v("offensive.avgTurnovers")), pf: r1(v("general.avgFouls")),
    fgm: r1(v("offensive.avgFieldGoalsMade")), fga: r1(v("offensive.avgFieldGoalsAttempted")),
    fg3m: r1(v("offensive.avgThreePointFieldGoalsMade")), fg3a: r1(v("offensive.avgThreePointFieldGoalsAttempted")),
    ftm: r1(v("offensive.avgFreeThrowsMade")), fta: r1(v("offensive.avgFreeThrowsAttempted")),
    fg2m: r1(v("offensive.avgTwoPointFieldGoalsMade")), fg2a: r1(v("offensive.avgTwoPointFieldGoalsAttempted")),
    fg_pct: r1(v("offensive.fieldGoalPct")), fg3_pct: r1(v("offensive.threePointFieldGoalPct") ?? v("offensive.threePointPct")),
    ft_pct: r1(v("offensive.freeThrowPct")), fg2_pct: r1(v("offensive.twoPointFieldGoalPct")),
    ts_pct: r1(v("offensive.trueShootingPct")), efg_pct: r1(v("offensive.effectiveFGPct")),
    pts_total: tot("offensive.points"), reb_total: tot("general.rebounds"), ast_total: tot("offensive.assists"),
    fg3m_total: tot("offensive.threePointFieldGoalsMade"), stl_total: tot("defensive.steals"), blk_total: tot("defensive.blocks"),
    min_total: tot("general.minutes"),
    per: nz(v("general.PER")), nba_rating: nz(v("general.NBARating")), usage_rate: nz(v("offensive.usageRate")), vorp: nz(v("general.VORP")),
    ast_to: v("general.assistTurnoverRatio"), stl_to: v("general.stealTurnoverRatio"),
    reb_rate: nz(v("general.reboundRate")), oreb_rate: nz(v("offensive.offReboundRate")), dreb_rate: nz(v("defensive.defReboundRate")),
    ast_ratio: nz(v("offensive.assistRatio")), tov_ratio: nz(v("offensive.turnoverRatio")),
    pts_per_poss: v("offensive.pointsPerEstimatedPossessions"),
    plus_minus: v("general.plusMinus") === null ? null : r1(v("general.plusMinus")! / gp),
    dd2: tot("general.doubleDouble"), td3: tot("general.tripleDouble"), pts_in_paint: nz(v("offensive.pointsInPaint")),
    stats: st });
  return true;
}

// full-season schedule per team: inserts not-yet-played games (scoreboard/summary own everything once a game starts)
async function syncSchedule(teamId: string) {
  const f = await getJsonOpt(urls.schedule(teamId, SEASON), DAY);
  if (!f) return 0;
  let n = 0;
  for (const e of f.body.events ?? []) {
    const c = e.competitions?.[0]; if (!c) continue;
    const home = c.competitors.find((x: any) => x.homeAway === "home"), away = c.competitors.find((x: any) => x.homeAway === "away");
    const known = (await db.query(`SELECT count(*)::int n FROM teams WHERE id = ANY($1::int[])`, [[+home.team.id, +away.team.id]])).rows[0].n;
    if (known < 2) continue;
    const r = await db.query(`INSERT INTO games (id, season, season_type, game_date, tipoff_at, home_team_id, away_team_id, status, name, short_name, neutral_site, broadcast_names)
      VALUES ($1,$2,$3,$4,$5,$6,$7,'scheduled',$8,$9,$10,$11)
      ON CONFLICT (id) DO UPDATE SET game_date=EXCLUDED.game_date, tipoff_at=EXCLUDED.tipoff_at
      WHERE games.status='scheduled' AND (games.game_date, games.tipoff_at) IS DISTINCT FROM (EXCLUDED.game_date, EXCLUDED.tipoff_at)`,
      [+e.id, e.season?.year ?? SEASON, e.seasonType?.type ?? 2, etDate(new Date(e.date)), e.date, +home.team.id, +away.team.id, e.name ?? null, e.shortName ?? null,
       c.neutralSite ?? null, (c.broadcasts ?? []).map((b: any) => b.media?.shortName).filter(Boolean)]);
    n += r.rowCount ?? 0;
  }
  bump("write:games(schedule)", n);
  return n;
}

// ---------- games ----------
async function syncScoreboard(day: string) {
  const ttl = day < addDays(todayEt, -1) ? Infinity : 600;
  const f = await getJson(urls.scoreboard(ymd(day)), ttl);
  await raw("scoreboard", ymd(day), f);
  const out: { id: string; status: string }[] = [];
  for (const e of f.body.events ?? []) {
    const c = e.competitions[0];
    const home = c.competitors.find((x: any) => x.homeAway === "home"), away = c.competitors.find((x: any) => x.homeAway === "away");
    const status = gameStatus(e.status);
    const score = (x: any) => (status === "scheduled" ? null : int(x.score));
    const known = (await db.query(`SELECT count(*)::int n FROM teams WHERE id = ANY($1::int[])`, [[+home.team.id, +away.team.id]])).rows[0].n;
    if (known < 2) { bump("games_skipped_non_nba_team"); continue; } // preseason vs international clubs
    const venueId = await venue(c.venue);
    await upsert("games", ["id"], { id: +e.id, season: e.season.year, season_type: e.season.type, game_date: day, tipoff_at: e.date,
      home_team_id: +home.team.id, away_team_id: +away.team.id, status, status_detail: e.status?.type?.shortDetail ?? null,
      period: e.status?.period ?? null, clock: e.status?.displayClock ?? null, home_score: score(home), away_score: score(away),
      home_record: home.records?.[0]?.summary ?? null, away_record: away.records?.[0]?.summary ?? null,
      venue_id: venueId, attendance: c.attendance || null, neutral_site: c.neutralSite ?? null, conference_game: c.conferenceCompetition ?? null,
      name: e.name ?? null, short_name: e.shortName ?? null, notes: c.notes?.length ? c.notes : null,
      broadcast_names: (c.broadcasts ?? []).flatMap((b: any) => b.names ?? []) });
    for (const x of [home, away]) if (x.linescores?.length)
      await replaceChildren("game_periods", "game_id=$1 AND team_id=$2", [+e.id, +x.team.id], "period smallint, points int",
        x.linescores.map((l: any, i: number) => ({ period: l.period ?? i + 1, points: int(l.value) })));
    out.push({ id: e.id, status });
  }
  return out;
}

const TEAMSTAT: Record<string, string> = { fastBreakPoints: "fast_break_pts", pointsInPaint: "pts_in_paint", largestLead: "largest_lead",
  turnoverPoints: "turnover_pts", totalRebounds: "reb", offensiveRebounds: "oreb", defensiveRebounds: "dreb", assists: "ast", steals: "stl",
  blocks: "blk", totalTurnovers: "tov", fouls: "pf" };

async function syncSummary(eventId: string, isFinal: boolean) {
  const f = await getJson(urls.summary(eventId), isFinal ? Infinity : 120);
  const { id: rawId, isNew } = await raw("summary", eventId, f);
  const gid = +eventId;
  if (!isNew && !args.reprocess) { bump("summary_unchanged"); return -1; }
  const b = f.body, comp = b.header?.competitions?.[0];
  const venueId = await venue(b.gameInfo?.venue);
  await db.query(`UPDATE games SET venue_id=coalesce($2,venue_id), attendance=coalesce($3,attendance), leaders=$4, season_series=$5,
      predictor=$6, against_the_spread=$7, injuries=$8 WHERE id=$1`,
    [gid, venueId, b.gameInfo?.attendance || null, JSON.stringify(b.leaders ?? null), JSON.stringify(b.seasonseries ?? null),
     JSON.stringify(b.predictor ?? null), JSON.stringify(b.againstTheSpread ?? null), JSON.stringify(b.injuries ?? null)]);
  for (const x of comp?.competitors ?? []) if (x.linescores?.length)
    await replaceChildren("game_periods", "game_id=$1 AND team_id=$2", [gid, +x.team.id], "period smallint, points int",
      x.linescores.map((l: any, i: number) => ({ period: i + 1, points: int(l.displayValue ?? l.value) })));
  await replaceChildren("game_officials", "game_id=$1", [gid], "ord smallint, name text, position text",
    (b.gameInfo?.officials ?? []).map((o: any, i: number) => ({ ord: o.order ?? i + 1, name: o.displayName ?? o.fullName, position: o.position?.displayName ?? null })));
  await replaceChildren("game_broadcasts", "game_id=$1", [gid], "ord smallint, type text, market text, station text, lang text, region text",
    (b.broadcasts ?? []).map((x: any, i: number) => ({ ord: i + 1, type: x.type?.shortName ?? null, market: x.market?.type ?? null,
      station: x.station ?? x.media?.shortName ?? null, lang: x.lang ?? null, region: x.region ?? null })));
  for (const o of b.pickcenter ?? [])
    await upsert("game_odds", ["game_id", "provider"], { game_id: gid, provider: o.provider?.name ?? "unknown", details: o.details ?? null,
      spread: num(o.spread), over_under: num(o.overUnder), home_moneyline: int(o.homeTeamOdds?.moneyLine), away_moneyline: int(o.awayTeamOdds?.moneyLine), raw: o });
  for (const t of b.boxscore?.teams ?? []) {
    const s = Object.fromEntries((t.statistics ?? []).map((x: any) => [x.name, x.displayValue]));
    const [fgm, fga] = ma(s["fieldGoalsMade-fieldGoalsAttempted"]), [fg3m, fg3a] = ma(s["threePointFieldGoalsMade-threePointFieldGoalsAttempted"]), [ftm, fta] = ma(s["freeThrowsMade-freeThrowsAttempted"]);
    const cc = comp?.competitors?.find((c: any) => c.team.id === t.team.id);
    const row: any = { game_id: gid, team_id: +t.team.id, home_away: t.homeAway ?? cc?.homeAway ?? "?", pts: int(cc?.score), fgm, fga, fg3m, fg3a, ftm, fta, stats: s };
    for (const [k, col] of Object.entries(TEAMSTAT)) row[col] = int(s[k]);
    await upsert("game_team_stats", ["game_id", "team_id"], row);
  }
  const plays = (b.plays ?? []).map((p: any) => ({ seq: int(p.sequenceNumber), play_id: p.id, period: p.period?.number ?? null, clock: p.clock?.displayValue ?? null,
    type: p.type?.text ?? null, text: p.text ?? null, team_id: int(p.team?.id), scoring: !!p.scoringPlay, score_value: int(p.scoreValue),
    shooting: !!p.shootingPlay, points_attempted: int(p.pointsAttempted), away_score: int(p.awayScore), home_score: int(p.homeScore),
    x: p.coordinate && Math.abs(p.coordinate.x) < 1000 ? int(p.coordinate.x) : null, y: p.coordinate && Math.abs(p.coordinate.y) < 1000 ? int(p.coordinate.y) : null,
    athletes: (p.participants ?? []).map((a: any) => +a.athlete.id), wallclock: p.wallclock ?? null })).filter((p: any) => p.seq !== null);
  const uniq = [...new Map(plays.map((p: any) => [p.seq, p])).values()];
  await replaceChildren("game_plays", "game_id=$1", [gid],
    "seq int, play_id text, period smallint, clock text, type text, text text, team_id int, scoring boolean, score_value smallint, shooting boolean, points_attempted smallint, away_score int, home_score int, x int, y int, athletes bigint[], wallclock timestamptz", uniq);
  await replaceChildren("game_win_probability", "game_id=$1", [gid], "ord int, play_id text, home_win_pct numeric, tie_pct numeric",
    (b.winprobability ?? []).map((w: any, i: number) => ({ ord: i + 1, play_id: w.playId, home_win_pct: r1(num(w.homeWinPercentage)! * 100), tie_pct: num(w.tiePercentage) })));
  let rows = 0;
  for (const tb of b.boxscore?.players ?? []) {
    const teamId = +tb.team.id, s = tb.statistics?.[0]; if (!s) continue;
    const ix = (k: string) => s.keys.indexOf(k);
    for (const a of s.athletes ?? []) {
      const st: string[] = a.stats ?? []; const g = (k: string) => (ix(k) >= 0 ? st[ix(k)] : undefined);
      const [fgm, fga] = ma(g("fieldGoalsMade-fieldGoalsAttempted")), [fg3m, fg3a] = ma(g("threePointFieldGoalsMade-threePointFieldGoalsAttempted")), [ftm, fta] = ma(g("freeThrowsMade-freeThrowsAttempted"));
      const pos = a.athlete.position?.abbreviation ?? null;
      await db.query(`INSERT INTO players (id, full_name, team_id, position, pos_group, jersey, headshot_url, is_active)
        VALUES ($1,$2,$3,$4,$5,$6,$7,false) ON CONFLICT (id) DO NOTHING`,
        [+a.athlete.id, a.athlete.displayName, teamId, pos, posGroup(pos), a.athlete.jersey ?? null, a.athlete.headshot?.href ?? null]);
      const dnp = !!a.didNotPlay || st.length === 0;
      await upsert("player_game_stats", ["game_id", "player_id"], { game_id: gid, player_id: +a.athlete.id, team_id: teamId, starter: !!a.starter,
        dnp, dnp_reason: dnp ? a.reason ?? null : null, ejected: !!a.ejected, minutes: dnp ? null : int(g("minutes")),
        pts: int(g("points")), reb: int(g("rebounds")), oreb: int(g("offensiveRebounds")), dreb: int(g("defensiveRebounds")), ast: int(g("assists")),
        stl: int(g("steals")), blk: int(g("blocks")), tov: int(g("turnovers")), pf: int(g("fouls")), fgm, fga, fg3m, fg3a, ftm, fta,
        plus_minus: int(g("plusMinus")), raw_id: rawId });
      rows++;
    }
  }
  if (isFinal && rows > 0) await db.query(`UPDATE games SET box_complete=true WHERE id=$1 AND NOT box_complete`, [gid]);
  return rows;
}

/** programmatic entry (Lambda): run(["--days-back=1"]) -> summary object */
export async function run(argv: string[]) {
  args = parseArgs(argv);
  SEASON = Number(args.season ?? 2027); PREV = Number(args["prev-season"] ?? SEASON - 1);
  for (const k of Object.keys(counts)) delete counts[k];
  Object.assign(stats, { requests: 0, cacheHits: 0, retries: 0, emptyBodies: 0, notFound: 0, errors: [], statusCounts: {} });
  db = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: /sslmode=require|supabase/.test(process.env.DATABASE_URL ?? "") ? { rejectUnauthorized: false } : undefined });
  const t0 = Date.now();
  await db.connect();
  todayEt = args.today ?? etDate(new Date());
  const mode = args.full ? "full" : "daily";
  runId = (await db.query(`INSERT INTO ingest_jobs (job, scope) VALUES ($1,$2) RETURNING id`, [mode, todayEt])).rows[0].id;
  const summary: any = { todayEt, mode, season: SEASON, prevSeason: PREV };
  const phase: Record<string, number> = {}; let tp = Date.now();
  const mark = (k: string) => { phase[k] = (Date.now() - tp) / 1000; tp = Date.now(); };
  try {
    // --games-only (frequent in-game runs): skip teams/rosters (60 requests); reference data comes from the nightly run
    const teamIds = args["games-only"] ? (await db.query(`SELECT id::text FROM teams ORDER BY id`)).rows.map((r: any) => r.id) : await syncTeams(); mark("teams");
    if (!args["games-only"]) { let p = 0; for (const t of teamIds) p += await syncRoster(t); summary.rosterPlayers = p; mark("rosters"); }
    await syncStandings(SEASON); summary.injuries = await syncInjuries(); mark("standings+injuries");
    if (args.full || args["team-stats"]) { for (const t of teamIds) await syncTeamStats(t, SEASON); mark("teamStats"); }
    if (args.full || args.schedule) { for (const t of teamIds) await syncSchedule(t); mark("schedule"); }

    const days: string[] = []; const games: { id: string; status: string }[] = [];
    if (args.dates) for (const d of args.dates.split(",")) days.push(d.length === 8 ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}` : d);
    else if (args.full) { for (let d = args.from ?? "2026-10-02"; d <= addDays(todayEt, Number(args.ahead ?? 1)); d = addDays(d, 1)) days.push(d); }
    else { for (let i = Number(args["days-back"] ?? 3); i >= -Number(args.ahead ?? 1); i--) days.push(addDays(todayEt, -i)); }
    for (const d of days) games.push(...(await syncScoreboard(d)));
    summary.days = `${days[0]}..${days.at(-1)} (${days.length})`; summary.games = games.length; mark("scoreboards");
    let box = 0, unchanged = 0; const noBox: string[] = [];
    for (const g of games) {
      if (g.status !== "final" && g.status !== "live") continue;
      const n = await syncSummary(g.id, g.status === "final");
      if (n === -1) unchanged++; else { box += n; if (!n) noBox.push(g.id); }
    }
    summary.boxRows = box; summary.summariesUnchanged = unchanged; summary.gamesWithoutBox = noBox; mark("summaries");

    if (args.full || args["zh-names"]) { summary.zhNames = await syncZhNames(); mark("zhNames"); }
    if (!args["no-core"]) {
      const pids: number[] = args.players ? args.players.split(",").map(Number) : (args.full
        ? await db.query(`SELECT id FROM players WHERE is_active OR id IN (SELECT player_id FROM player_game_stats s JOIN games g ON g.id=s.game_id WHERE g.season=$1) ORDER BY id`, [SEASON])
        : await db.query(`SELECT DISTINCT s.player_id AS id FROM player_game_stats s JOIN games g ON g.id=s.game_id WHERE g.game_date = ANY($1::date[]) AND NOT s.dnp`, [days])
      ).rows.map((r: any) => Number(r.id));
      let cur = 0, prev = 0;
      for (const pid of pids) {
        if ((args.full || args.players) && !args["no-bios"]) await syncBio(pid);
        if (await syncCoreStats(pid, SEASON, 2, 6 * 3600)) cur++;
        if ((args.full || args.players) && (await syncCoreStats(pid, PREV, 2, 30 * DAY))) prev++;
      }
      summary.coreStats = { players: pids.length, [SEASON]: cur, [PREV]: prev }; mark("core");
    }
    await db.query(`UPDATE ingest_jobs SET status='ok', finished_at=now(), items=$2, http_requests=$3, stats=$4 WHERE id=$1`,
      [runId, box, stats.requests, JSON.stringify({ counts, phase })]);
  } catch (e: any) {
    await db.query(`UPDATE ingest_jobs SET status='error', finished_at=now(), error=$2 WHERE id=$1`, [runId, String(e.stack ?? e)]);
    throw e;
  } finally {
    summary.runtimeSec = (Date.now() - t0) / 1000; summary.phaseSec = phase; summary.writes = counts; summary.http = stats;
    await db.end();
  }
  return summary;
}
// CLI
if (process.argv[1] && /sync\.ts$/.test(process.argv[1]))
  run(process.argv.slice(2)).then((s) => console.log(JSON.stringify(s, null, 1)), (e) => { console.error(e); process.exit(1); });
