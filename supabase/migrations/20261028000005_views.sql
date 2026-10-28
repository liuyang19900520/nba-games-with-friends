-- 5/6 views: season stats from box scores, unified season stats (ESPN core preferred, box fallback), league ranks.
-- security_invoker: caller RLS applies.
CREATE VIEW public.player_box_season_totals WITH (security_invoker = true) AS
SELECT s.player_id, g.season, g.season_type,
  (array_agg(s.team_id ORDER BY g.tipoff_at DESC))[1] AS last_team_id,
  count(*) AS gp, count(*) FILTER (WHERE s.starter) AS gs,
  sum(s.minutes) AS min, sum(s.pts) AS pts, sum(s.reb) AS reb, sum(s.oreb) AS oreb, sum(s.dreb) AS dreb,
  sum(s.ast) AS ast, sum(s.stl) AS stl, sum(s.blk) AS blk, sum(s.tov) AS tov, sum(s.pf) AS pf,
  sum(s.fgm) AS fgm, sum(s.fga) AS fga, sum(s.fg3m) AS fg3m, sum(s.fg3a) AS fg3a, sum(s.ftm) AS ftm, sum(s.fta) AS fta,
  sum(s.plus_minus) AS plus_minus,
  count(*) FILTER (WHERE (s.pts>=10)::int+(s.reb>=10)::int+(s.ast>=10)::int+(s.stl>=10)::int+(s.blk>=10)::int >= 2) AS dd2,
  count(*) FILTER (WHERE (s.pts>=10)::int+(s.reb>=10)::int+(s.ast>=10)::int+(s.stl>=10)::int+(s.blk>=10)::int >= 3) AS td3
FROM public.player_game_stats s JOIN public.games g ON g.id = s.game_id
WHERE NOT s.dnp AND coalesce(s.minutes,0) > 0
GROUP BY s.player_id, g.season, g.season_type;

CREATE VIEW public.player_box_season_averages WITH (security_invoker = true) AS
SELECT t.player_id, t.season, t.season_type, t.last_team_id AS team_id, t.gp, t.gs,
  round(t.min::numeric/t.gp,1) AS min, round(t.pts::numeric/t.gp,1) AS pts, round(t.reb::numeric/t.gp,1) AS reb,
  round(t.oreb::numeric/t.gp,1) AS oreb, round(t.dreb::numeric/t.gp,1) AS dreb, round(t.ast::numeric/t.gp,1) AS ast,
  round(t.stl::numeric/t.gp,1) AS stl, round(t.blk::numeric/t.gp,1) AS blk, round(t.tov::numeric/t.gp,1) AS tov,
  round(t.pf::numeric/t.gp,1) AS pf, round(t.fgm::numeric/t.gp,1) AS fgm, round(t.fga::numeric/t.gp,1) AS fga,
  round(t.fg3m::numeric/t.gp,1) AS fg3m, round(t.fg3a::numeric/t.gp,1) AS fg3a, round(t.ftm::numeric/t.gp,1) AS ftm,
  round(t.fta::numeric/t.gp,1) AS fta,
  round(100.0*t.fgm/nullif(t.fga,0),1) AS fg_pct, round(100.0*t.fg3m/nullif(t.fg3a,0),1) AS fg3_pct,
  round(100.0*t.ftm/nullif(t.fta,0),1) AS ft_pct,
  round(100.0*t.pts/nullif(2*(t.fga+0.44*t.fta),0),1) AS ts_pct,
  round(100.0*(t.fgm+0.5*t.fg3m)/nullif(t.fga,0),1) AS efg_pct,
  t.pts::int AS pts_total, t.reb::int AS reb_total, t.ast::int AS ast_total, t.stl::int AS stl_total, t.blk::int AS blk_total,
  t.fg3m::int AS fg3m_total, round(t.ast::numeric/nullif(t.tov,0),2) AS ast_to, round(t.stl::numeric/nullif(t.tov,0),2) AS stl_to,
  round(t.plus_minus::numeric/t.gp,1) AS plus_minus, t.dd2::int AS dd2, t.td3::int AS td3
FROM public.player_box_season_totals t;

-- unified: ESPN core row if present, else computed from our box scores
CREATE VIEW public.player_season_stats WITH (security_invoker = true) AS
SELECT player_id, season, season_type, team_id, gp, gs, min, pts, reb, oreb, dreb, ast, stl, blk, tov, pf, fgm, fga, fg3m, fg3a, ftm, fta, fg_pct, fg3_pct, ft_pct, ts_pct, efg_pct, pts_total, reb_total, ast_total, stl_total, blk_total, fg3m_total, per, nba_rating, usage_rate, vorp, ast_to, stl_to, reb_rate, pts_per_poss, plus_minus, dd2, td3, 'espn'::text AS source FROM public.player_season_stats_espn
UNION ALL
SELECT b.player_id, b.season, b.season_type, b.team_id, b.gp, b.gs, b.min, b.pts, b.reb, b.oreb, b.dreb, b.ast, b.stl, b.blk, b.tov, b.pf,
  b.fgm, b.fga, b.fg3m, b.fg3a, b.ftm, b.fta, b.fg_pct, b.fg3_pct, b.ft_pct, b.ts_pct, b.efg_pct, b.pts_total, b.reb_total, b.ast_total,
  b.stl_total, b.blk_total, b.fg3m_total, NULL, NULL, NULL, NULL, b.ast_to, b.stl_to, NULL, NULL, b.plus_minus, b.dd2, b.td3, 'box'
FROM public.player_box_season_averages b
WHERE NOT EXISTS (SELECT 1 FROM public.player_season_stats_espn e WHERE e.player_id=b.player_id AND e.season=b.season AND e.season_type=b.season_type);

-- league ranks: rank() per stat. Qualified (per-game & %): gp >= ceil(0.7 * max gp of season); % stats also need attempts/game.
CREATE VIEW public.player_season_ranks WITH (security_invoker = true) AS
WITH q AS (
  SELECT s.*, (s.gp >= greatest(1, ceil(0.7 * max(s.gp) OVER (PARTITION BY s.season, s.season_type)))) AS qualified
  FROM public.player_season_stats s)
SELECT player_id, season, season_type, qualified,
  CASE WHEN qualified AND min IS NOT NULL THEN rank() OVER (PARTITION BY season, season_type, (qualified AND min IS NOT NULL) ORDER BY min DESC) END AS min_rank,
  CASE WHEN qualified AND pts IS NOT NULL THEN rank() OVER (PARTITION BY season, season_type, (qualified AND pts IS NOT NULL) ORDER BY pts DESC) END AS pts_rank,
  CASE WHEN qualified AND reb IS NOT NULL THEN rank() OVER (PARTITION BY season, season_type, (qualified AND reb IS NOT NULL) ORDER BY reb DESC) END AS reb_rank,
  CASE WHEN qualified AND oreb IS NOT NULL THEN rank() OVER (PARTITION BY season, season_type, (qualified AND oreb IS NOT NULL) ORDER BY oreb DESC) END AS oreb_rank,
  CASE WHEN qualified AND dreb IS NOT NULL THEN rank() OVER (PARTITION BY season, season_type, (qualified AND dreb IS NOT NULL) ORDER BY dreb DESC) END AS dreb_rank,
  CASE WHEN qualified AND ast IS NOT NULL THEN rank() OVER (PARTITION BY season, season_type, (qualified AND ast IS NOT NULL) ORDER BY ast DESC) END AS ast_rank,
  CASE WHEN qualified AND stl IS NOT NULL THEN rank() OVER (PARTITION BY season, season_type, (qualified AND stl IS NOT NULL) ORDER BY stl DESC) END AS stl_rank,
  CASE WHEN qualified AND blk IS NOT NULL THEN rank() OVER (PARTITION BY season, season_type, (qualified AND blk IS NOT NULL) ORDER BY blk DESC) END AS blk_rank,
  CASE WHEN qualified AND tov IS NOT NULL THEN rank() OVER (PARTITION BY season, season_type, (qualified AND tov IS NOT NULL) ORDER BY tov DESC) END AS tov_rank,
  CASE WHEN qualified AND pf IS NOT NULL THEN rank() OVER (PARTITION BY season, season_type, (qualified AND pf IS NOT NULL) ORDER BY pf DESC) END AS pf_rank,
  CASE WHEN qualified AND fgm IS NOT NULL THEN rank() OVER (PARTITION BY season, season_type, (qualified AND fgm IS NOT NULL) ORDER BY fgm DESC) END AS fgm_rank,
  CASE WHEN qualified AND fga IS NOT NULL THEN rank() OVER (PARTITION BY season, season_type, (qualified AND fga IS NOT NULL) ORDER BY fga DESC) END AS fga_rank,
  CASE WHEN qualified AND fg3m IS NOT NULL THEN rank() OVER (PARTITION BY season, season_type, (qualified AND fg3m IS NOT NULL) ORDER BY fg3m DESC) END AS fg3m_rank,
  CASE WHEN qualified AND fg3a IS NOT NULL THEN rank() OVER (PARTITION BY season, season_type, (qualified AND fg3a IS NOT NULL) ORDER BY fg3a DESC) END AS fg3a_rank,
  CASE WHEN qualified AND ftm IS NOT NULL THEN rank() OVER (PARTITION BY season, season_type, (qualified AND ftm IS NOT NULL) ORDER BY ftm DESC) END AS ftm_rank,
  CASE WHEN qualified AND fta IS NOT NULL THEN rank() OVER (PARTITION BY season, season_type, (qualified AND fta IS NOT NULL) ORDER BY fta DESC) END AS fta_rank,
  CASE WHEN qualified AND per IS NOT NULL THEN rank() OVER (PARTITION BY season, season_type, (qualified AND per IS NOT NULL) ORDER BY per DESC) END AS per_rank,
  CASE WHEN qualified AND nba_rating IS NOT NULL THEN rank() OVER (PARTITION BY season, season_type, (qualified AND nba_rating IS NOT NULL) ORDER BY nba_rating DESC) END AS nba_rating_rank,
  CASE WHEN qualified AND usage_rate IS NOT NULL THEN rank() OVER (PARTITION BY season, season_type, (qualified AND usage_rate IS NOT NULL) ORDER BY usage_rate DESC) END AS usage_rate_rank,
  CASE WHEN qualified AND ast_to IS NOT NULL THEN rank() OVER (PARTITION BY season, season_type, (qualified AND ast_to IS NOT NULL) ORDER BY ast_to DESC) END AS ast_to_rank,
  CASE WHEN qualified AND stl_to IS NOT NULL THEN rank() OVER (PARTITION BY season, season_type, (qualified AND stl_to IS NOT NULL) ORDER BY stl_to DESC) END AS stl_to_rank,
  CASE WHEN qualified AND reb_rate IS NOT NULL THEN rank() OVER (PARTITION BY season, season_type, (qualified AND reb_rate IS NOT NULL) ORDER BY reb_rate DESC) END AS reb_rate_rank,
  CASE WHEN qualified AND pts_per_poss IS NOT NULL THEN rank() OVER (PARTITION BY season, season_type, (qualified AND pts_per_poss IS NOT NULL) ORDER BY pts_per_poss DESC) END AS pts_per_poss_rank,
  CASE WHEN qualified AND plus_minus IS NOT NULL THEN rank() OVER (PARTITION BY season, season_type, (qualified AND plus_minus IS NOT NULL) ORDER BY plus_minus DESC) END AS plus_minus_rank,
  CASE WHEN qualified AND fga >= 3 AND fg_pct IS NOT NULL THEN rank() OVER (PARTITION BY season, season_type, (qualified AND fga >= 3 AND fg_pct IS NOT NULL) ORDER BY fg_pct DESC) END AS fg_pct_rank,
  CASE WHEN qualified AND fg3a >= 1 AND fg3_pct IS NOT NULL THEN rank() OVER (PARTITION BY season, season_type, (qualified AND fg3a >= 1 AND fg3_pct IS NOT NULL) ORDER BY fg3_pct DESC) END AS fg3_pct_rank,
  CASE WHEN qualified AND fta >= 1 AND ft_pct IS NOT NULL THEN rank() OVER (PARTITION BY season, season_type, (qualified AND fta >= 1 AND ft_pct IS NOT NULL) ORDER BY ft_pct DESC) END AS ft_pct_rank,
  CASE WHEN qualified AND fga >= 3 AND ts_pct IS NOT NULL THEN rank() OVER (PARTITION BY season, season_type, (qualified AND fga >= 3 AND ts_pct IS NOT NULL) ORDER BY ts_pct DESC) END AS ts_pct_rank,
  CASE WHEN qualified AND fga >= 3 AND efg_pct IS NOT NULL THEN rank() OVER (PARTITION BY season, season_type, (qualified AND fga >= 3 AND efg_pct IS NOT NULL) ORDER BY efg_pct DESC) END AS efg_pct_rank,
  CASE WHEN pts_total IS NOT NULL THEN rank() OVER (PARTITION BY season, season_type, (pts_total IS NOT NULL) ORDER BY pts_total DESC) END AS pts_total_rank,
  CASE WHEN fg3m_total IS NOT NULL THEN rank() OVER (PARTITION BY season, season_type, (fg3m_total IS NOT NULL) ORDER BY fg3m_total DESC) END AS fg3m_total_rank,
  CASE WHEN vorp IS NOT NULL THEN rank() OVER (PARTITION BY season, season_type, (vorp IS NOT NULL) ORDER BY vorp DESC) END AS vorp_rank,
  CASE WHEN dd2 IS NOT NULL THEN rank() OVER (PARTITION BY season, season_type, (dd2 IS NOT NULL) ORDER BY dd2 DESC) END AS dd2_rank,
  CASE WHEN td3 IS NOT NULL THEN rank() OVER (PARTITION BY season, season_type, (td3 IS NOT NULL) ORDER BY td3 DESC) END AS td3_rank,
  CASE WHEN gp IS NOT NULL THEN rank() OVER (PARTITION BY season, season_type, (gp IS NOT NULL) ORDER BY gp DESC) END AS gp_rank,
  CASE WHEN reb_total IS NOT NULL THEN rank() OVER (PARTITION BY season, season_type, (reb_total IS NOT NULL) ORDER BY reb_total DESC) END AS reb_total_rank,
  CASE WHEN ast_total IS NOT NULL THEN rank() OVER (PARTITION BY season, season_type, (ast_total IS NOT NULL) ORDER BY ast_total DESC) END AS ast_total_rank,
  CASE WHEN stl_total IS NOT NULL THEN rank() OVER (PARTITION BY season, season_type, (stl_total IS NOT NULL) ORDER BY stl_total DESC) END AS stl_total_rank,
  CASE WHEN blk_total IS NOT NULL THEN rank() OVER (PARTITION BY season, season_type, (blk_total IS NOT NULL) ORDER BY blk_total DESC) END AS blk_total_rank
FROM q;
