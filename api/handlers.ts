// Framework-agnostic API: plain (req) => res. Adapters: api/lambda.ts (AWS Lambda / Function URL), local/server.ts (node http :8787),
// scripts/export-snapshot.ts (writes every response to static JSON files). Contract: /workspace/work/nba-mvp/API-CONTRACT.md
import { q } from "./db.ts";
import { SEASON_TYPES, INJURY_ZH, STATUS_ZH, STAT_LABELS, LEADER_CATS, BASIC_AVG, ADV } from "./i18n.ts";
export interface Req { method: string; path: string; query: Record<string, string | undefined> }
export interface Res { status: number; headers: Record<string, string>; body: string }

const etToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
const isDate = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
const isId = (s?: string) => !!s && /^\d{1,12}$/.test(s);
const CORS = { "access-control-allow-origin": "*", "access-control-allow-methods": "GET,OPTIONS", "access-control-allow-headers": "*" };
const json = (status: number, data: unknown, cache: string): Res => ({ status, body: JSON.stringify(data),
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": cache, ...CORS } });
const err = (status: number, code: string, message: string) => json(status, { error: { code, message } }, "no-store");
const SHORT = "public, max-age=15, s-maxage=30, stale-while-revalidate=120";
const MID = "public, max-age=60, s-maxage=300, stale-while-revalidate=3600";
const LONG = "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400";
const seasonLabel = (s: number) => `${s - 1}-${String(s).slice(2)}`;
const STATE: Record<string, string> = { scheduled: "pre", live: "in", final: "final", postponed: "pre", canceled: "final" };

// ---- SQL fragments ----
const TEAM = (a: string, i: string) => `json_build_object('id',${a}.id,'abbr',${a}.abbr,'name',${a}.name,'name_zh',${i}.name_zh,
  'short_name',${a}.short_name,'short_name_zh',${i}.short_name_zh,'logo_url',${a}.logo_url,'color',${a}.color)`;
const TJ = (a: string, i: string, col: string) => `JOIN teams ${a} ON ${a}.id=${col} LEFT JOIN team_i18n ${i} ON ${i}.team_id=${a}.id`;
const SALARY = (p: string) => `(SELECT salary FROM player_salaries s WHERE s.player_id=${p}.id AND s.season<=$SEASON ORDER BY season DESC LIMIT 1)`;
const INJ = (p: string) => `(SELECT json_build_object('status',i.status,'date',i.date,'type',i.type,'detail',i.detail,'side',i.side,'return_date',i.return_date,'short_comment',i.short_comment)
  FROM injuries i WHERE i.player_id=${p}.id ORDER BY i.date DESC NULLS LAST LIMIT 1)`;

let curSeasonCache: { v: number; at: number } | undefined;
async function currentSeason(): Promise<number> {
  if (curSeasonCache && Date.now() - curSeasonCache.at < 600_000) return curSeasonCache.v;
  const [r] = await q(`SELECT coalesce((SELECT season FROM games WHERE game_date<=$1 ORDER BY game_date DESC LIMIT 1),(SELECT max(season) FROM games), 2027) s`, [etToday()]);
  curSeasonCache = { v: Number(r.s), at: Date.now() }; return curSeasonCache.v;
}
const seasonOf = async (r: Req) => (Number(r.query.season) > 1990 ? Number(r.query.season) : await currentSeason());
const typeOf = (r: Req) => ([1, 2, 3, 5].includes(Number(r.query.season_type)) ? Number(r.query.season_type) : 2);
const withPosZh = (rows: any[]) => rows;

// ---- meta ----
async function meta() {
  const season = await currentSeason();
  const seasons = await q(`SELECT season, array_agg(DISTINCT season_type ORDER BY season_type) types FROM (
      SELECT season, season_type FROM games UNION SELECT season, season_type FROM player_season_stats_espn) x GROUP BY season ORDER BY season DESC`);
  const teams = await q(`SELECT i.team_id, i.abbr, i.name_zh, i.short_name_zh, i.conference, i.division, i.division_zh FROM team_i18n i ORDER BY team_id`);
  const pos = await q(`SELECT position, name_en, name_zh FROM position_i18n`);
  const cats = (t: string) => LEADER_CATS.filter((c) => c.type === t).map((c) => ({ key: c.key, kind: c.kind, ...STAT_LABELS[c.key] }));
  const [sync] = await q(`SELECT job, finished_at, status FROM ingest_jobs WHERE status='ok' ORDER BY finished_at DESC LIMIT 1`);
  return json(200, { current_season: season, current_season_label: seasonLabel(season), today_et: etToday(),
    seasons: seasons.map((s) => ({ season: s.season, label: seasonLabel(s.season), types: s.types })),
    season_types: SEASON_TYPES, leader_categories: { basic: cats("basic"), advanced: cats("advanced") },
    positions_zh: Object.fromEntries(pos.map((p) => [p.position, p.name_zh])), injury_status_zh: INJURY_ZH, game_status_zh: STATUS_ZH,
    conferences_zh: { East: "东部", West: "西部" }, stat_labels: STAT_LABELS,
    teams_zh: Object.fromEntries(teams.map((t) => [t.team_id, t])), last_sync: sync ?? null }, MID);
}

// ---- teams / standings ----
const STANDING = (s: string) => `CASE WHEN ${s}.team_id IS NULL THEN NULL ELSE json_build_object('conf_rank',${s}.conf_rank,'seed',${s}.seed,'wins',${s}.wins,'losses',${s}.losses,
  'win_pct',${s}.win_pct,'games_behind',${s}.games_behind,'home',${s}.home,'away',${s}.road,'conf',${s}.vs_conf,'div',${s}.vs_div,'last10',${s}.last10,
  'streak',${s}.streak,'ppg',${s}.ppg,'opp_ppg',${s}.opp_ppg,'diff',${s}.diff,'clincher',${s}.clincher) END`;
const TEAM_FULL = `t.id, t.abbr, t.name, i.name_zh, t.short_name, i.short_name_zh, t.location, t.nickname, t.color, t.alt_color, t.logo_url, t.logo_dark_url,
  i.conference, CASE i.conference WHEN 'East' THEN '东部' ELSE '西部' END AS conference_zh, i.division, i.division_zh, t.standing_summary`;

async function teams(r: Req) {
  const season = await seasonOf(r);
  const rows = await q(`SELECT ${TEAM_FULL}, ${STANDING("s")} AS standing
    FROM teams t LEFT JOIN team_i18n i ON i.team_id=t.id LEFT JOIN standings s ON s.team_id=t.id AND s.season=$1
    ORDER BY i.conference, s.conf_rank NULLS LAST, t.abbr`, [season]);
  return json(200, { season, teams: rows }, MID);
}

async function standings(r: Req) {
  const season = await seasonOf(r);
  const rows = await q(`SELECT s.conference, s.conf_rank AS rank, ${TEAM("t", "i")} AS team, s.wins, s.losses, s.win_pct, s.games_behind,
      s.home, s.road AS away, s.vs_conf AS conf, s.vs_div AS div, s.last10, s.streak, s.ppg, s.opp_ppg, s.diff, s.seed, s.clincher,
      i.division, i.division_zh, s.stats AS espn
    FROM standings s ${TJ("t", "i", "s.team_id")} WHERE s.season=$1 ORDER BY s.conference, s.conf_rank`, [season]);
  const conf = (c: string) => ({ abbr: c, name: c === "East" ? "Eastern Conference" : "Western Conference", name_zh: c === "East" ? "东部" : "西部",
    teams: rows.filter((x) => x.conference === c).map(({ conference, ...x }) => x) });
  return json(200, { season, conferences: [conf("East"), conf("West")] }, MID);
}

async function team(id: string, r: Req) {
  if (!isId(id)) return err(400, "bad_id", "id must be numeric");
  const season = await seasonOf(r), st = typeOf(r);
  const [t] = await q(`SELECT ${TEAM_FULL}, t.record, ${STANDING("s")} AS standing,
      CASE WHEN v.id IS NULL THEN NULL ELSE json_build_object('id',v.id,'name',v.name,'city',v.city,'state',v.state,'capacity',v.capacity,'indoor',v.indoor,'image_url',v.image_url) END AS venue
    FROM teams t LEFT JOIN team_i18n i ON i.team_id=t.id LEFT JOIN standings s ON s.team_id=t.id AND s.season=$2 LEFT JOIN venues v ON v.id=t.venue_id WHERE t.id=$1`, [id, season]);
  if (!t) return err(404, "not_found", "team not found");
  const recs = Object.fromEntries((t.record ?? []).map((it: any) => [it.type, { summary: it.summary, ...Object.fromEntries((it.stats ?? []).map((s: any) => [s.name, s.value])) }]));
  t.record = recs;
  t.coaches = await q(`SELECT id, first_name || ' ' || last_name AS name, first_name, last_name, role, experience FROM coaches WHERE team_id=$1 AND season=(SELECT max(season) FROM coaches WHERE team_id=$1)`, [id]);
  const roster = await q(`SELECT p.id, p.full_name AS name, p.name_zh, p.jersey, p.position, pi.name_zh AS position_zh, p.headshot_url, p.age,
      p.display_height AS height, p.display_weight AS weight, p.height_in, p.weight_lb, p.experience_years AS experience, p.college, p.birth_date,
      ${SALARY("p").replace("$SEASON", "$2")} AS salary, ${INJ("p")} AS injury,
      CASE WHEN ss.player_id IS NULL THEN NULL ELSE json_build_object('gp',ss.gp,'gs',ss.gs,'min',ss.min,'pts',ss.pts,'reb',ss.reb,'oreb',ss.oreb,'dreb',ss.dreb,'ast',ss.ast,
        'stl',ss.stl,'blk',ss.blk,'tov',ss.tov,'pf',ss.pf,'fg_pct',ss.fg_pct,'fg3_pct',ss.fg3_pct,'ft_pct',ss.ft_pct,'ts_pct',ss.ts_pct,'per',ss.per,'plus_minus',ss.plus_minus) END AS averages
    FROM players p LEFT JOIN position_i18n pi ON pi.position=p.position
    LEFT JOIN player_season_stats ss ON ss.player_id=p.id AND ss.season=$2 AND ss.season_type=$3
    WHERE p.team_id=$1 AND p.is_active ORDER BY ss.pts DESC NULLS LAST, p.full_name`, [id, season, st]);
  const schedule = await q(`SELECT g.id, g.game_date AS date, g.tipoff_at AS start_time, g.season_type, g.status, g.status_detail,
      CASE WHEN g.home_team_id=$1 THEN 'home' ELSE 'away' END AS home_away,
      CASE WHEN g.home_team_id=$1 THEN ${TEAM("a", "ai")} ELSE ${TEAM("h", "hi")} END AS opponent,
      CASE WHEN g.home_team_id=$1 THEN g.home_score ELSE g.away_score END AS team_score,
      CASE WHEN g.home_team_id=$1 THEN g.away_score ELSE g.home_score END AS opp_score, g.broadcast_names AS broadcasts
    FROM games g ${TJ("h", "hi", "g.home_team_id")} ${TJ("a", "ai", "g.away_team_id")}
    WHERE (g.home_team_id=$1 OR g.away_team_id=$1) AND g.season=$2 ORDER BY g.tipoff_at`, [id, season]);
  for (const g of schedule) g.result = g.status === "final" && g.team_score != null ? (g.team_score > g.opp_score ? "W" : "L") : null;
  const [ts] = await q(`SELECT season, season_type, gp, stats FROM team_season_stats WHERE team_id=$1 AND season=$2 AND season_type=$3`, [id, season, st]);
  const [box] = await q(`SELECT count(*)::int gp, round(avg(gts.pts),1) pts, round(avg(gts.reb),1) reb, round(avg(gts.oreb),1) oreb, round(avg(gts.dreb),1) dreb,
      round(avg(gts.ast),1) ast, round(avg(gts.stl),1) stl, round(avg(gts.blk),1) blk, round(avg(gts.tov),1) tov, round(avg(gts.pf),1) pf,
      round(100.0*sum(gts.fgm)/nullif(sum(gts.fga),0),1) fg_pct, round(100.0*sum(gts.fg3m)/nullif(sum(gts.fg3a),0),1) fg3_pct,
      round(100.0*sum(gts.ftm)/nullif(sum(gts.fta),0),1) ft_pct, round(avg(gts.fast_break_pts),1) fast_break_pts,
      round(avg(gts.pts_in_paint),1) pts_in_paint, round(avg(gts.turnover_pts),1) turnover_pts
    FROM game_team_stats gts JOIN games g ON g.id=gts.game_id WHERE gts.team_id=$1 AND g.season=$2 AND g.season_type=$3`, [id, season, st]);
  const stats = ts ? Object.fromEntries(Object.entries(ts.stats).map(([k, v]: any) => [k, { value: v.v, display: v.d, rank: v.rank }])) : null;
  const { standing, ...team } = t;
  return json(200, { season, season_type: st, team: { ...team, standing }, executives: null, roster, schedule,
    team_stats: { espn: stats ? { gp: ts.gp, stats } : null, from_box_scores: box?.gp ? box : null } }, MID);
}

// ---- players ----
async function players(r: Req) {
  const season = await seasonOf(r), st = typeOf(r);
  const limit = Math.min(Math.max(Number(r.query.limit) || 50, 1), 600), offset = Math.max(Number(r.query.offset) || 0, 0);
  const qs = r.query.q?.trim() || null, teamQ = r.query.team || null, pos = r.query.position?.toUpperCase() || null;
  const all = r.query.active === "0";
  const where = `($1::text IS NULL OR p.full_name ILIKE '%'||$1||'%' OR p.name_zh LIKE '%'||$1||'%')
      AND ($2::text IS NULL OR t.id::text=$2 OR upper(t.abbr)=upper($2)) AND ($3::text IS NULL OR p.position=$3 OR p.pos_group=$3) AND (${all} OR p.is_active)`;
  const [{ n }] = await q(`SELECT count(*)::int n FROM players p LEFT JOIN teams t ON t.id=p.team_id WHERE ${where}`, [qs, teamQ, pos]);
  const rows = await q(`SELECT p.id, p.full_name AS name, p.name_zh, CASE WHEN t.id IS NULL THEN NULL ELSE ${TEAM("t", "i")} END AS team,
      p.position, pi.name_zh AS position_zh, p.jersey, p.headshot_url, p.age, p.display_height AS height, p.display_weight AS weight, p.is_active,
      ${SALARY("p").replace("$SEASON", "$4")} AS salary, p.injury_status, ss.gp, ss.min, ss.pts, ss.reb, ss.ast, ss.stl, ss.blk, ss.fg_pct, ss.fg3_pct, ss.ft_pct, ss.per
    FROM players p LEFT JOIN teams t ON t.id=p.team_id LEFT JOIN team_i18n i ON i.team_id=t.id LEFT JOIN position_i18n pi ON pi.position=p.position
    LEFT JOIN player_season_stats ss ON ss.player_id=p.id AND ss.season=$4 AND ss.season_type=$5
    WHERE ${where} ORDER BY ss.pts DESC NULLS LAST, p.full_name LIMIT $6 OFFSET $7`, [qs, teamQ, pos, season, st, limit, offset]);
  return json(200, { season, season_type: st, total: n, limit, offset, players: rows }, MID);
}

const GAMELOG = `SELECT g.id AS game_id, g.game_date AS date, g.season, g.season_type, s.team_id,
    CASE WHEN s.team_id=g.home_team_id THEN 'home' ELSE 'away' END AS home_away,
    CASE WHEN s.team_id=g.home_team_id THEN ${TEAM("a", "ai")} ELSE ${TEAM("h", "hi")} END AS opponent,
    CASE WHEN g.status<>'final' THEN NULL WHEN (s.team_id=g.home_team_id) = (g.home_score>g.away_score) THEN 'W' ELSE 'L' END AS result,
    CASE WHEN s.team_id=g.home_team_id THEN g.home_score||'-'||g.away_score ELSE g.away_score||'-'||g.home_score END AS score,
    s.starter, s.dnp, s.dnp_reason, s.minutes AS min, s.pts, s.reb, s.oreb, s.dreb, s.ast, s.stl, s.blk, s.tov, s.pf,
    s.fgm, s.fga, s.fg3m, s.fg3a, s.ftm, s.fta, s.plus_minus
  FROM player_game_stats s JOIN games g ON g.id=s.game_id ${TJ("h", "hi", "g.home_team_id")} ${TJ("a", "ai", "g.away_team_id")}`;

async function player(id: string, r: Req) {
  if (!isId(id)) return err(400, "bad_id", "id must be numeric");
  const season = await seasonOf(r), st = typeOf(r);
  const [p] = await q(`SELECT p.id, p.full_name AS name, p.first_name, p.last_name, p.short_name, p.name_zh,
      CASE WHEN t.id IS NULL THEN NULL ELSE ${TEAM("t", "i")} END AS team, p.is_active,
      p.position, p.position_name, pi.name_zh AS position_zh, p.jersey, p.headshot_url,
      p.height_in, p.display_height AS height, p.weight_lb, p.display_weight AS weight, p.birth_date, p.age,
      concat_ws(', ', p.birth_city, p.birth_state, p.birth_country) AS birth_place, p.birth_city, p.birth_state, p.birth_country,
      p.college, p.experience_years AS experience, p.debut_year,
      CASE WHEN p.draft_year IS NULL THEN NULL ELSE json_build_object('year',p.draft_year,'round',p.draft_round,'pick',p.draft_pick,
        'team',(SELECT abbr FROM teams WHERE id=p.draft_team_id),'team_id',p.draft_team_id,'display',p.draft_display) END AS draft,
      p.status, ${SALARY("p").replace("$SEASON", "$2")} AS salary, ${INJ("p")} AS injury
    FROM players p LEFT JOIN teams t ON t.id=p.team_id LEFT JOIN team_i18n i ON i.team_id=t.id LEFT JOIN position_i18n pi ON pi.position=p.position
    WHERE p.id=$1`, [id, season]);
  if (!p) return err(404, "not_found", "player not found");
  if (p.injury) p.injury.status_zh = INJURY_ZH[p.injury.status] ?? null;
  p.contracts = await q(`SELECT s.season, s.salary, t.abbr AS team_abbr FROM player_salaries s LEFT JOIN teams t ON t.id=s.team_id WHERE s.player_id=$1 ORDER BY s.season`, [id]);
  const [ss] = await q(`SELECT s.*, r.* FROM player_season_stats s LEFT JOIN player_season_ranks r USING (player_id, season, season_type)
    WHERE s.player_id=$1 AND s.season=$2 AND s.season_type=$3`, [id, season, st]);
  const pack = (keys: string[]) => (ss ? Object.fromEntries(keys.map((k) => [k, { value: ss[k] ?? null, rank: ss[k + "_rank"] ?? null }])) : null);
  const [{ n: pool }] = await q(`SELECT count(*) FILTER (WHERE qualified)::int n FROM player_season_ranks WHERE season=$1 AND season_type=$2`, [season, st]);
  const [espn] = await q(`SELECT stats FROM player_season_stats_espn WHERE player_id=$1 AND season=$2 AND season_type=$3`, [id, season, st]);
  const espnStats: any = {};
  for (const [k, v] of Object.entries<any>(espn?.stats ?? {})) { const [cat, name] = k.split("."); (espnStats[cat] ??= {})[name] = { value: v.v, display: v.d, espn_rank: v.rank }; }
  const seasons = await q(`SELECT s.season, s.season_type, t.abbr AS team_abbr, s.gp, s.gs, s.min, s.pts, s.reb, s.oreb, s.dreb, s.ast, s.stl, s.blk, s.tov, s.pf,
      s.fgm, s.fga, s.fg3m, s.fg3a, s.ftm, s.fta, s.fg_pct, s.fg3_pct, s.ft_pct, s.ts_pct, s.efg_pct, s.per, s.nba_rating, s.plus_minus, s.source
    FROM player_season_stats s LEFT JOIN teams t ON t.id=s.team_id WHERE s.player_id=$1 ORDER BY s.season DESC, s.season_type DESC`, [id]);
  for (const s of seasons) s.label = seasonLabel(s.season);
  const game_log = await q(`${GAMELOG} WHERE s.player_id=$1 AND g.season=$2 ORDER BY g.tipoff_at DESC`, [id, season]);
  return json(200, { season, season_type: st, player: p,
    averages: pack(BASIC_AVG), advanced: pack(ADV),
    rank_pool: { qualified: ss?.qualified ?? false, players: pool, rule: "gp >= 70% of max gp; % stats also need attempts/game (FG 3, 3P 1, FT 1)" },
    espn_stats: espn ? espnStats : null, seasons, game_log }, SHORT);
}

async function gamelog(id: string, r: Req) {
  if (!isId(id)) return err(400, "bad_id", "id must be numeric");
  const season = await seasonOf(r);
  const st = r.query.season_type ? typeOf(r) : null;
  const rows = await q(`${GAMELOG} WHERE s.player_id=$1 AND g.season=$2 AND ($3::int IS NULL OR g.season_type=$3) ORDER BY g.tipoff_at DESC`, [id, season, st]);
  return json(200, { player_id: Number(id), season, season_type: st, games: rows }, SHORT);
}

// ---- leaders ----
async function leadersFor(cat: (typeof LEADER_CATS)[number], season: number, st: number, limit: number, minGp: number | null) {
  const qual = cat.kind === "total" ? "true" : `gp >= ${minGp ?? "greatest(1, ceil(0.7*mg))"}${cat.attempts ? ` AND ${cat.attempts}` : ""}`;
  return q(`WITH s AS (SELECT *, max(gp) OVER () mg FROM player_season_stats WHERE season=$1 AND season_type=$2),
      r AS (SELECT s.*, rank() OVER (ORDER BY ${cat.col} DESC) rk FROM s WHERE ${cat.col} IS NOT NULL AND ${qual})
    SELECT r.rk::int AS rank, r.${cat.col} AS value, json_build_object('id',p.id,'name',p.full_name,'name_zh',p.name_zh,'headshot_url',p.headshot_url,
        'position',p.position,'jersey',p.jersey) AS player,
      CASE WHEN t.id IS NULL THEN NULL ELSE ${TEAM("t", "i")} END AS team, r.gp,
      json_build_object('pts',r.pts,'reb',r.reb,'ast',r.ast,'stl',r.stl,'blk',r.blk,'min',r.min,'fg_pct',r.fg_pct,'fg3_pct',r.fg3_pct,'ft_pct',r.ft_pct) AS stats
    FROM r JOIN players p ON p.id=r.player_id LEFT JOIN teams t ON t.id=coalesce(r.team_id,p.team_id) LEFT JOIN team_i18n i ON i.team_id=t.id
    WHERE r.rk <= $3 ORDER BY r.rk, p.full_name LIMIT $3 + 5`, [season, st, limit]);
}
async function leaders(r: Req) {
  const season = await seasonOf(r), st = typeOf(r);
  const minGp = Number(r.query.min_gp) > 0 ? Math.floor(Number(r.query.min_gp)) : null;
  if (r.query.category) {
    const cat = LEADER_CATS.find((c) => c.key === r.query.category);
    if (!cat) return err(400, "bad_category", "category must be one of " + LEADER_CATS.map((c) => c.key).join(","));
    const limit = Math.min(Math.max(Number(r.query.limit) || 50, 1), 500);
    return json(200, { season, season_type: st, category: { key: cat.key, type: cat.type, kind: cat.kind, ...STAT_LABELS[cat.key] },
      min_gp: minGp, leaders: await leadersFor(cat, season, st, limit, minGp) }, MID);
  }
  const type = r.query.type === "advanced" ? "advanced" : r.query.type === "all" ? null : "basic";
  const limit = Math.min(Math.max(Number(r.query.limit) || 5, 1), 20);
  const cats = [];
  for (const c of LEADER_CATS.filter((c) => !type || c.type === type))
    cats.push({ key: c.key, type: c.type, kind: c.kind, ...STAT_LABELS[c.key], leaders: await leadersFor(c, season, st, limit, minGp) });
  return json(200, { season, season_type: st, type: type ?? "all", categories: cats }, MID);
}

// legacy alias for old web/: /stats/players?sort=ppg...
async function legacyStats(r: Req) {
  const map: Record<string, string> = { ppg: "pts", rpg: "reb", apg: "ast", spg: "stl", bpg: "blk", mpg: "min", ts_pct: "ts_pct", efg_pct: "efg_pct" };
  return leaders({ ...r, query: { ...r.query, category: map[r.query.sort ?? "ppg"] ?? "pts" } });
}

// ---- games ----
const GAME_ROW = `g.id, g.game_date AS date, g.tipoff_at AS start_time, g.season, g.season_type, g.status, g.status_detail, g.period, g.clock,
  g.name, g.short_name, g.neutral_site, g.conference_game, g.attendance, g.broadcast_names AS broadcasts, g.box_complete,
  ${TEAM("h", "hi")}::jsonb || jsonb_build_object('score',g.home_score,'record',g.home_record,'winner',g.status='final' AND g.home_score>g.away_score,
    'linescores',(SELECT coalesce(jsonb_agg(gp.points ORDER BY gp.period),'[]') FROM game_periods gp WHERE gp.game_id=g.id AND gp.team_id=g.home_team_id)) AS home,
  ${TEAM("a", "ai")}::jsonb || jsonb_build_object('score',g.away_score,'record',g.away_record,'winner',g.status='final' AND g.away_score>g.home_score,
    'linescores',(SELECT coalesce(jsonb_agg(gp.points ORDER BY gp.period),'[]') FROM game_periods gp WHERE gp.game_id=g.id AND gp.team_id=g.away_team_id)) AS away,
  CASE WHEN v.id IS NULL THEN NULL ELSE json_build_object('id',v.id,'name',v.name,'city',v.city,'state',v.state,'image_url',v.image_url) END AS venue,
  (SELECT json_build_object('provider',o.provider,'details',o.details,'spread',o.spread,'over_under',o.over_under,'home_moneyline',o.home_moneyline,'away_moneyline',o.away_moneyline)
     FROM game_odds o WHERE o.game_id=g.id ORDER BY o.provider LIMIT 1) AS odds`;
const GAME_FROM = `FROM games g ${TJ("h", "hi", "g.home_team_id")} ${TJ("a", "ai", "g.away_team_id")} LEFT JOIN venues v ON v.id=g.venue_id`;

async function listLeaders(ids: number[]) {
  if (!ids.length) return new Map();
  const rows = await q(`SELECT DISTINCT ON (s.game_id, s.team_id, c.k) s.game_id, s.team_id, c.k, s.player_id, p.full_name AS name, p.name_zh, c.v AS value
    FROM player_game_stats s JOIN players p ON p.id=s.player_id
    CROSS JOIN LATERAL (VALUES ('pts', s.pts), ('reb', s.reb), ('ast', s.ast)) c(k, v)
    WHERE s.game_id = ANY($1::bigint[]) AND NOT s.dnp AND c.v IS NOT NULL ORDER BY s.game_id, s.team_id, c.k, c.v DESC, s.minutes DESC NULLS LAST`, [ids]);
  const m = new Map<number, any>();
  for (const x of rows) ((m.get(x.game_id) ?? m.set(x.game_id, {}).get(x.game_id))[x.team_id] ??= {})[x.k] = { player_id: x.player_id, player_name: x.name, name_zh: x.name_zh, value: x.value };
  return m;
}
const decorate = (g: any, L?: any) => ({ ...g, state: STATE[g.status] ?? g.status, status_zh: STATUS_ZH[g.status] ?? null,
  leaders: L ? { home: L[g.home.id] ?? null, away: L[g.away.id] ?? null } : undefined });

async function games(r: Req) {
  let rows: any[]; let meta: any;
  if (r.query.team) {
    const season = await seasonOf(r);
    rows = await q(`SELECT ${GAME_ROW} ${GAME_FROM} WHERE (h.id::text=$1 OR a.id::text=$1 OR upper(h.abbr)=upper($1) OR upper(a.abbr)=upper($1)) AND g.season=$2 ORDER BY g.tipoff_at`, [r.query.team, season]);
    meta = { team: r.query.team, season };
  } else if (r.query.from || r.query.to) {
    const from = r.query.from ?? r.query.to!, to = r.query.to ?? from;
    if (!isDate(from) || !isDate(to)) return err(400, "bad_date", "from/to must be YYYY-MM-DD");
    if ((Date.parse(to) - Date.parse(from)) / 864e5 > 31 || to < from) return err(400, "bad_range", "range must be 0..31 days");
    rows = await q(`SELECT ${GAME_ROW} ${GAME_FROM} WHERE g.game_date BETWEEN $1 AND $2 ORDER BY g.tipoff_at, g.id`, [from, to]);
    meta = { from, to };
  } else {
    const date = r.query.date ?? etToday();
    if (!isDate(date)) return err(400, "bad_date", "date must be YYYY-MM-DD");
    rows = await q(`SELECT ${GAME_ROW} ${GAME_FROM} WHERE g.game_date=$1 ORDER BY g.tipoff_at, g.id`, [date]);
    const [nav] = await q(`SELECT (SELECT max(game_date) FROM games WHERE game_date<$1) prev_date, (SELECT min(game_date) FROM games WHERE game_date>$1) next_date`, [date]);
    meta = { date, ...nav };
  }
  const L = await listLeaders(rows.filter((g) => g.status !== "scheduled").map((g) => Number(g.id)));
  const done = rows.length > 0 && rows.every((g) => g.status === "final" || g.status === "canceled");
  return json(200, { ...meta, games: rows.map((g) => decorate(g, L.get(Number(g.id)))) }, done ? LONG : SHORT);
}

async function plays(id: string, sinceSeq = 0) {
  return q(`SELECT seq, play_id AS id, period, clock, type, text, team_id, scoring, score_value, shooting, points_attempted, away_score, home_score, x, y, athletes, wallclock
    FROM game_plays WHERE game_id=$1 AND seq > $2 ORDER BY seq`, [id, sinceSeq]);
}

async function game(id: string, r: Req) {
  if (!isId(id)) return err(400, "bad_id", "id must be numeric");
  const [g0] = await q(`SELECT ${GAME_ROW}, g.leaders AS espn_leaders, g.season_series, g.predictor, g.against_the_spread, g.injuries AS espn_injuries ${GAME_FROM} WHERE g.id=$1`, [id]);
  if (!g0) return err(404, "not_found", "game not found");
  const { espn_leaders, season_series, predictor, against_the_spread, espn_injuries, ...g } = g0;
  g.linescores = await q(`SELECT team_id, period, points FROM game_periods WHERE game_id=$1 ORDER BY team_id, period`, [id]);
  g.officials = await q(`SELECT ord AS "order", name, position FROM game_officials WHERE game_id=$1 ORDER BY ord`, [id]);
  g.broadcast_detail = await q(`SELECT type, market, station, lang, region FROM game_broadcasts WHERE game_id=$1 ORDER BY ord`, [id]);
  g.odds_all = await q(`SELECT provider, details, spread, over_under, home_moneyline, away_moneyline, raw FROM game_odds WHERE game_id=$1`, [id]);
  g.season_series = season_series; g.predictor = predictor; g.against_the_spread = against_the_spread;
  const team_stats = await q(`SELECT team_id, home_away, pts, fgm, fga, fg3m, fg3a, ftm, fta, reb, oreb, dreb, ast, stl, blk, tov, pf,
      fast_break_pts, pts_in_paint, largest_lead, turnover_pts, stats FROM game_team_stats WHERE game_id=$1 ORDER BY home_away DESC`, [id]);
  const pl = await q(`SELECT s.team_id, s.player_id, p.full_name AS name, p.name_zh, p.short_name, p.jersey, p.position, pi.name_zh AS position_zh, p.headshot_url,
      s.starter, s.dnp, s.dnp_reason, s.ejected, s.minutes AS min, s.pts, s.reb, s.oreb, s.dreb, s.ast, s.stl, s.blk, s.tov, s.pf,
      s.fgm, s.fga, s.fg3m, s.fg3a, s.ftm, s.fta, s.plus_minus
    FROM player_game_stats s JOIN players p ON p.id=s.player_id LEFT JOIN position_i18n pi ON pi.position=p.position
    WHERE s.game_id=$1 ORDER BY s.starter DESC, s.dnp, s.minutes DESC NULLS LAST`, [id]);
  const K = ["min", "pts", "reb", "oreb", "dreb", "ast", "stl", "blk", "tov", "pf", "fgm", "fga", "fg3m", "fg3a", "ftm", "fta"];
  const box = [g.home.id, g.away.id].map((tid: number) => {
    const ps = pl.filter((x) => x.team_id === tid);
    const totals: any = Object.fromEntries(K.map((k) => [k, ps.reduce((a, x) => a + (x[k] ?? 0), 0)]));
    return { team_id: tid, players: ps.map(({ team_id, ...x }) => x), totals };
  });
  const LZH: Record<string, string> = { points: "得分", rebounds: "篮板", assists: "助攻", rating: "评分", pointsPerGame: "场均得分", reboundsPerGame: "场均篮板", assistsPerGame: "场均助攻" };
  const leaders = (espn_leaders ?? []).map((t: any) => ({ team_id: Number(t.team?.id), categories: (t.leaders ?? []).map((c: any) => ({
    name: c.name, display_name: c.displayName, zh: LZH[c.name] ?? null, player_id: Number(c.leaders?.[0]?.athlete?.id) || null,
    player_name: c.leaders?.[0]?.athlete?.displayName ?? null, headshot_url: c.leaders?.[0]?.athlete?.headshot?.href ?? null,
    value: c.leaders?.[0]?.displayValue ?? null, summary: c.leaders?.[0]?.summary ?? null })) }));
  const injuries = (espn_injuries ?? []).flatMap((t: any) => (t.injuries ?? []).map((i: any) => ({ team_id: Number(t.team?.id),
    player_id: Number(i.athlete?.id) || null, name: i.athlete?.displayName ?? null, status: i.status ?? null, status_zh: INJURY_ZH[i.status] ?? null,
    date: i.date ?? null, type: i.details?.type ?? i.type?.description ?? null, detail: i.details?.detail ?? null, side: i.details?.side ?? null,
    return_date: i.details?.returnDate ?? null })));
  const win_probability = await q(`SELECT ord AS seq, play_id, home_win_pct, tie_pct FROM game_win_probability WHERE game_id=$1 ORDER BY ord`, [id]);
  const body: any = { game: decorate(g), team_stats, box, leaders, injuries, win_probability };
  if (r.query.plays !== "0") body.plays = await plays(id);
  return json(200, body, g.status === "final" && g.box_complete ? LONG : SHORT);
}

async function gamePlays(id: string, r: Req) {
  if (!isId(id)) return err(400, "bad_id", "id must be numeric");
  const [g] = await q(`SELECT status, box_complete FROM games WHERE id=$1`, [id]);
  if (!g) return err(404, "not_found", "game not found");
  return json(200, { game_id: Number(id), plays: await plays(id, Number(r.query.since) || 0) }, g.status === "final" && g.box_complete ? LONG : SHORT);
}

async function injuries() {
  const rows = await q(`SELECT i.team_id, ${TEAM("t", "ti")} AS team, json_build_object('id',i.player_id,'name',coalesce(p.full_name,i.raw->'athlete'->>'displayName'),
      'name_zh',p.name_zh,'position',coalesce(p.position,i.raw->'athlete'->>'position'),'headshot_url',coalesce(p.headshot_url,i.raw->'athlete'->>'headshot'),'jersey',p.jersey) AS player,
      i.status, i.date, i.type, i.detail, i.side, i.return_date, i.short_comment, i.long_comment, i.updated_at
    FROM injuries i ${TJ("t", "ti", "i.team_id")} LEFT JOIN players p ON p.id=i.player_id ORDER BY t.abbr, i.date DESC`);
  const byTeam = new Map<number, any>();
  for (const { team_id, team, updated_at, ...x } of rows) {
    (byTeam.get(team_id) ?? byTeam.set(team_id, { team, injuries: [] }).get(team_id)).injuries.push({ ...x, status_zh: INJURY_ZH[x.status] ?? null });
  }
  const updated = rows.reduce((m, x) => (x.updated_at > m ? x.updated_at : m), null as any);
  return json(200, { updated_at: updated, total: rows.length, teams: [...byTeam.values()] }, MID);
}

async function health() {
  const t0 = Date.now();
  try { await q("SELECT 1"); return json(200, { ok: true, db: "up", db_ms: Date.now() - t0, et_today: etToday() }, "no-store"); }
  catch (e) { return json(503, { ok: false, db: "down", error: String((e as Error).message) }, "no-store"); }
}

export const ROUTES = ["/api/v1/health", "/api/v1/meta", "/api/v1/teams", "/api/v1/teams/:id", "/api/v1/standings", "/api/v1/players",
  "/api/v1/players/:id", "/api/v1/players/:id/gamelog", "/api/v1/leaders", "/api/v1/games", "/api/v1/games/:id", "/api/v1/games/:id/plays",
  "/api/v1/injuries", "/api/v1/stats/players"];

export async function route(r: Req): Promise<Res> {
  if (r.method === "OPTIONS") return { status: 204, body: "", headers: { ...CORS, "access-control-max-age": "86400" } };
  if (r.method !== "GET" && r.method !== "HEAD") return err(405, "method_not_allowed", "GET only");
  const p = r.path.replace(/\/+$/, "").replace(/\.json$/, "");
  let m: RegExpExecArray | null;
  try {
    if (p === "/api/v1" || p === "/api/v1/") return json(200, { routes: ROUTES }, LONG);
    if (p === "/api/v1/health") return await health();
    if (p === "/api/v1/meta") return await meta();
    if (p === "/api/v1/teams") return await teams(r);
    if ((m = /^\/api\/v1\/teams\/([^/]+)$/.exec(p))) return await team(m[1], r);
    if (p === "/api/v1/standings") return await standings(r);
    if (p === "/api/v1/players") return await players(r);
    if ((m = /^\/api\/v1\/players\/([^/]+)\/gamelog$/.exec(p))) return await gamelog(m[1], r);
    if ((m = /^\/api\/v1\/players\/([^/]+)$/.exec(p))) return await player(m[1], r);
    if (p === "/api/v1/leaders") return await leaders(r);
    if (p === "/api/v1/games") return await games(r);
    if ((m = /^\/api\/v1\/games\/([^/]+)\/plays$/.exec(p))) return await gamePlays(m[1], r);
    if ((m = /^\/api\/v1\/games\/([^/]+)$/.exec(p))) return await game(m[1], r);
    if (p === "/api/v1/injuries") return await injuries();
    if (p === "/api/v1/stats/players") return await legacyStats(r);
    return err(404, "not_found", "no such endpoint");
  } catch (e) { console.error(e); return err(500, "internal", "internal error"); }
}
