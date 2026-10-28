-- 4/6 user side (groups + lineups; no fantasy scoring)
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname text NOT NULL DEFAULT 'player', avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN INSERT INTO profiles (id, nickname) VALUES (NEW.id, coalesce(NEW.raw_user_meta_data->>'nickname','player')) ON CONFLICT DO NOTHING; RETURN NEW; END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.groups (
  id bigserial PRIMARY KEY, name text NOT NULL,
  invite_code text NOT NULL UNIQUE DEFAULT substr(md5(random()::text || clock_timestamp()::text),1,10),
  owner_id uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());

CREATE TABLE public.group_members (
  group_id bigint NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner','member')),
  joined_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (group_id, user_id));
CREATE INDEX group_members_user_idx ON public.group_members (user_id);

CREATE OR REPLACE FUNCTION public.add_owner_member() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN INSERT INTO group_members (group_id, user_id, role) VALUES (NEW.id, NEW.owner_id, 'owner'); RETURN NEW; END $$;
CREATE TRIGGER groups_owner AFTER INSERT ON public.groups FOR EACH ROW EXECUTE FUNCTION public.add_owner_member();

-- contest = one US/Eastern game day (global; groups share it)
CREATE TABLE public.contests (
  game_date date PRIMARY KEY, season int NOT NULL,
  first_tipoff_at timestamptz,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','live','final')),
  finalized_at timestamptz);

CREATE TABLE public.lineups (
  id bigserial PRIMARY KEY,
  group_id bigint NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE DEFAULT auth.uid(),
  game_date date NOT NULL REFERENCES public.contests(game_date),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id, game_date));
CREATE INDEX lineups_day_idx ON public.lineups (game_date, group_id);
CREATE INDEX lineups_user_idx ON public.lineups (user_id);

CREATE TABLE public.lineup_players (
  lineup_id bigint NOT NULL REFERENCES public.lineups(id) ON DELETE CASCADE,
  slot text NOT NULL,                      -- G1,G2,F1,F2,C
  player_id bigint NOT NULL REFERENCES public.players(id),
  game_id bigint NOT NULL REFERENCES public.games(id),
  salary_snapshot bigint,
  PRIMARY KEY (lineup_id, slot), UNIQUE (lineup_id, player_id));
CREATE INDEX lineup_players_game_idx ON public.lineup_players (game_id);

CREATE TRIGGER profiles_upd BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER groups_upd BEFORE UPDATE ON public.groups FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER lineups_upd BEFORE UPDATE ON public.lineups FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- lock: a pick cannot be added/changed/removed once ITS game has tipped off; game must be on the lineup's day
CREATE OR REPLACE FUNCTION public.enforce_lineup_lock() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE t timestamptz; d date; ld date;
BEGIN
  IF TG_OP IN ('UPDATE','DELETE') THEN
    SELECT tipoff_at INTO t FROM games WHERE id = OLD.game_id;
    IF t <= now() THEN RAISE EXCEPTION 'player % locked: game % tipped off at %', OLD.player_id, OLD.game_id, t USING ERRCODE = 'P0001'; END IF;
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  END IF;
  SELECT tipoff_at, game_date INTO t, d FROM games WHERE id = NEW.game_id;
  SELECT game_date INTO ld FROM lineups WHERE id = NEW.lineup_id;
  IF t <= now() THEN RAISE EXCEPTION 'player % locked: game % tipped off at %', NEW.player_id, NEW.game_id, t USING ERRCODE = 'P0001'; END IF;
  IF d <> ld THEN RAISE EXCEPTION 'game % is not on %', NEW.game_id, ld; END IF;
  IF NOT EXISTS (
       SELECT 1 FROM players p JOIN games g ON g.id = NEW.game_id
       WHERE p.id = NEW.player_id AND p.team_id IN (g.home_team_id, g.away_team_id)) THEN
    RAISE EXCEPTION 'player % not in game %', NEW.player_id, NEW.game_id; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER lineup_players_lock BEFORE INSERT OR UPDATE OR DELETE ON public.lineup_players
  FOR EACH ROW EXECUTE FUNCTION public.enforce_lineup_lock();
