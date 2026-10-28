-- 2/6 games + everything in ESPN summary: periods, team stats, box, officials, broadcasts, odds, plays, win prob, injuries, leaders
CREATE TABLE public.games (
  id bigint PRIMARY KEY, season int NOT NULL, season_type smallint NOT NULL,
  game_date date NOT NULL, tipoff_at timestamptz NOT NULL,
  home_team_id int NOT NULL REFERENCES public.teams(id), away_team_id int NOT NULL REFERENCES public.teams(id),
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','live','final','postponed','canceled')),
  status_detail text, period smallint, clock text, home_score int, away_score int,
  home_record text, away_record text,
  venue_id int REFERENCES public.venues(id), attendance int, neutral_site boolean, conference_game boolean,
  name text, short_name text, notes jsonb, broadcast_names text[],
  leaders jsonb, season_series jsonb, predictor jsonb, against_the_spread jsonb, injuries jsonb,
  box_complete boolean NOT NULL DEFAULT false, final_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX games_date_idx ON public.games (game_date);
CREATE INDEX games_home_idx ON public.games (home_team_id, season);
CREATE INDEX games_away_idx ON public.games (away_team_id, season);
CREATE INDEX games_open_idx ON public.games (status) WHERE status <> 'final';

CREATE TABLE public.game_periods (                    -- quarter / OT scores
  game_id bigint NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  team_id int NOT NULL REFERENCES public.teams(id), period smallint NOT NULL, points int,
  PRIMARY KEY (game_id, team_id, period));

CREATE TABLE public.game_team_stats (
  game_id bigint NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  team_id int NOT NULL REFERENCES public.teams(id), home_away text NOT NULL,
  pts int, fgm int, fga int, fg3m int, fg3a int, ftm int, fta int, reb int, oreb int, dreb int,
  ast int, stl int, blk int, tov int, pf int, fast_break_pts int, pts_in_paint int, largest_lead int, turnover_pts int,
  stats jsonb NOT NULL,                               -- all name -> displayValue
  PRIMARY KEY (game_id, team_id));

CREATE TABLE public.player_game_stats (
  game_id bigint NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  player_id bigint NOT NULL REFERENCES public.players(id),
  team_id int NOT NULL REFERENCES public.teams(id),
  starter boolean NOT NULL DEFAULT false, dnp boolean NOT NULL DEFAULT false, dnp_reason text, ejected boolean,
  minutes smallint, pts smallint, reb smallint, oreb smallint, dreb smallint, ast smallint,
  stl smallint, blk smallint, tov smallint, pf smallint, fgm smallint, fga smallint,
  fg3m smallint, fg3a smallint, ftm smallint, fta smallint, plus_minus smallint,
  raw_id bigint REFERENCES public.espn_raw(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (game_id, player_id));
CREATE INDEX pgs_player_idx ON public.player_game_stats (player_id, game_id);

CREATE TABLE public.game_officials (
  game_id bigint NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  ord smallint NOT NULL, name text NOT NULL, position text, PRIMARY KEY (game_id, ord));

CREATE TABLE public.game_broadcasts (
  game_id bigint NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  ord smallint NOT NULL, type text, market text, station text, lang text, region text, PRIMARY KEY (game_id, ord));

CREATE TABLE public.game_odds (
  game_id bigint NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  provider text NOT NULL, details text, spread numeric, over_under numeric,
  home_moneyline int, away_moneyline int, raw jsonb, fetched_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (game_id, provider));

CREATE TABLE public.game_plays (                      -- compact play-by-play
  game_id bigint NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  seq int NOT NULL, play_id text, period smallint, clock text, type text, text text,
  team_id int, scoring boolean, score_value smallint, shooting boolean, points_attempted smallint,
  away_score int, home_score int, x int, y int, athletes bigint[], wallclock timestamptz,
  PRIMARY KEY (game_id, seq));

CREATE TABLE public.game_win_probability (
  game_id bigint NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  ord int NOT NULL, play_id text, home_win_pct numeric, tie_pct numeric, PRIMARY KEY (game_id, ord));

CREATE TRIGGER games_upd BEFORE UPDATE ON public.games FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER pgs_upd BEFORE UPDATE ON public.player_game_stats FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
