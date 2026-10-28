-- 3/6 standings, injuries, ESPN season stats (players incl. advanced, teams)
CREATE TABLE public.standings (
  season int NOT NULL, team_id int NOT NULL REFERENCES public.teams(id),
  conference text, conf_rank int, seed int, wins int, losses int, win_pct numeric, games_behind numeric,
  home text, road text, vs_div text, vs_conf text, last10 text, streak text,
  ppg numeric, opp_ppg numeric, diff numeric, clincher text,
  stats jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (season, team_id));

CREATE TABLE public.injuries (                        -- current league injury report (replaced each sync)
  id bigint PRIMARY KEY,                              -- ESPN injury id
  player_id bigint NOT NULL, team_id int REFERENCES public.teams(id),
  status text, date timestamptz, type text, detail text, side text, return_date date,
  short_comment text, long_comment text, raw jsonb, updated_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX injuries_player_idx ON public.injuries (player_id);

CREATE TABLE public.team_season_stats (
  team_id int NOT NULL REFERENCES public.teams(id), season int NOT NULL, season_type smallint NOT NULL,
  gp int, stats jsonb NOT NULL,                       -- {name: {value, display, rank, category}}
  updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (team_id, season, season_type));

-- ESPN core athlete statistics per season (current + previous seasons). Per-game values unless *_total.
CREATE TABLE public.player_season_stats_espn (
  player_id bigint NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  season int NOT NULL, season_type smallint NOT NULL, team_id int,
  gp int, gs int, min numeric, pts numeric, reb numeric, oreb numeric, dreb numeric, ast numeric,
  stl numeric, blk numeric, tov numeric, pf numeric,
  fgm numeric, fga numeric, fg3m numeric, fg3a numeric, ftm numeric, fta numeric, fg2m numeric, fg2a numeric,
  fg_pct numeric, fg3_pct numeric, ft_pct numeric, fg2_pct numeric, ts_pct numeric, efg_pct numeric,
  pts_total int, reb_total int, ast_total int, fg3m_total int, stl_total int, blk_total int, min_total int,
  per numeric, nba_rating numeric, usage_rate numeric, vorp numeric, ast_to numeric, stl_to numeric,
  reb_rate numeric, oreb_rate numeric, dreb_rate numeric, ast_ratio numeric, tov_ratio numeric,
  pts_per_poss numeric, plus_minus numeric, dd2 int, td3 int, pts_in_paint numeric,
  stats jsonb NOT NULL,                               -- every ESPN stat: {cat.name: {v, d, rank}}
  updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (player_id, season, season_type));
CREATE INDEX psse_season_idx ON public.player_season_stats_espn (season, season_type);
