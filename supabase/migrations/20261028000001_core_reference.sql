-- nba v2 single-DB schema (Supabase, schema public). 1/6 ingestion + reference data (teams, venues, players, coaches, salaries)
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;

CREATE TABLE public.ingest_jobs (
  id bigserial PRIMARY KEY, job text NOT NULL, scope text,
  started_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','ok','error')),
  items int NOT NULL DEFAULT 0, http_requests int, stats jsonb, error text);
CREATE INDEX ingest_jobs_job_idx ON public.ingest_jobs (job, started_at DESC);

-- raw payloads: identical payload stored once (endpoint, key, sha256)
CREATE TABLE public.espn_raw (
  id bigserial PRIMARY KEY,
  job_id bigint REFERENCES public.ingest_jobs(id) ON DELETE SET NULL,
  endpoint text NOT NULL, resource_key text NOT NULL, url text NOT NULL,
  http_status int NOT NULL, sha256 text NOT NULL, payload jsonb NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(), processed_at timestamptz,
  UNIQUE (endpoint, resource_key, sha256));
CREATE INDEX espn_raw_lookup_idx ON public.espn_raw (endpoint, resource_key, fetched_at DESC);

-- static zh labels (no FK so it can be seeded before teams are synced)
CREATE TABLE public.team_i18n (
  team_id int PRIMARY KEY, abbr text NOT NULL, name_zh text NOT NULL, short_name_zh text NOT NULL,
  conference text NOT NULL CHECK (conference IN ('East','West')), division text NOT NULL, division_zh text NOT NULL);
INSERT INTO public.team_i18n VALUES
 (1,'ATL','亚特兰大老鹰','老鹰','East','Southeast','东南赛区'),(2,'BOS','波士顿凯尔特人','凯尔特人','East','Atlantic','大西洋赛区'),
 (3,'NO','新奥尔良鹈鹕','鹈鹕','West','Southwest','西南赛区'),(4,'CHI','芝加哥公牛','公牛','East','Central','中部赛区'),
 (5,'CLE','克利夫兰骑士','骑士','East','Central','中部赛区'),(6,'DAL','达拉斯独行侠','独行侠','West','Southwest','西南赛区'),
 (7,'DEN','丹佛掘金','掘金','West','Northwest','西北赛区'),(8,'DET','底特律活塞','活塞','East','Central','中部赛区'),
 (9,'GS','金州勇士','勇士','West','Pacific','太平洋赛区'),(10,'HOU','休斯顿火箭','火箭','West','Southwest','西南赛区'),
 (11,'IND','印第安纳步行者','步行者','East','Central','中部赛区'),(12,'LAC','洛杉矶快船','快船','West','Pacific','太平洋赛区'),
 (13,'LAL','洛杉矶湖人','湖人','West','Pacific','太平洋赛区'),(14,'MIA','迈阿密热火','热火','East','Southeast','东南赛区'),
 (15,'MIL','密尔沃基雄鹿','雄鹿','East','Central','中部赛区'),(16,'MIN','明尼苏达森林狼','森林狼','West','Northwest','西北赛区'),
 (17,'BKN','布鲁克林篮网','篮网','East','Atlantic','大西洋赛区'),(18,'NY','纽约尼克斯','尼克斯','East','Atlantic','大西洋赛区'),
 (19,'ORL','奥兰多魔术','魔术','East','Southeast','东南赛区'),(20,'PHI','费城76人','76人','East','Atlantic','大西洋赛区'),
 (21,'PHX','菲尼克斯太阳','太阳','West','Pacific','太平洋赛区'),(22,'POR','波特兰开拓者','开拓者','West','Northwest','西北赛区'),
 (23,'SAC','萨克拉门托国王','国王','West','Pacific','太平洋赛区'),(24,'SA','圣安东尼奥马刺','马刺','West','Southwest','西南赛区'),
 (25,'OKC','俄克拉荷马城雷霆','雷霆','West','Northwest','西北赛区'),(26,'UTAH','犹他爵士','爵士','West','Northwest','西北赛区'),
 (27,'WSH','华盛顿奇才','奇才','East','Southeast','东南赛区'),(28,'TOR','多伦多猛龙','猛龙','East','Atlantic','大西洋赛区'),
 (29,'MEM','孟菲斯灰熊','灰熊','West','Southwest','西南赛区'),(30,'CHA','夏洛特黄蜂','黄蜂','East','Southeast','东南赛区');

CREATE TABLE public.position_i18n (position text PRIMARY KEY, name_en text NOT NULL, name_zh text NOT NULL);
INSERT INTO public.position_i18n VALUES ('PG','Point Guard','控球后卫'),('SG','Shooting Guard','得分后卫'),('SF','Small Forward','小前锋'),
 ('PF','Power Forward','大前锋'),('C','Center','中锋'),('G','Guard','后卫'),('F','Forward','前锋'),('G-F','Guard-Forward','锋卫摇摆'),('F-C','Forward-Center','锋线/中锋');

CREATE TABLE public.venues (
  id int PRIMARY KEY, name text NOT NULL, short_name text, city text, state text, country text,
  capacity int, indoor boolean, image_url text, raw jsonb, updated_at timestamptz NOT NULL DEFAULT now());

CREATE TABLE public.teams (
  id int PRIMARY KEY, abbr text NOT NULL UNIQUE, name text NOT NULL, name_zh text,
  short_name text, location text, nickname text, slug text, color text, alt_color text,
  logo_url text, logo_dark_url text, venue_id int REFERENCES public.venues(id),
  standing_summary text, record jsonb,                -- ESPN team.record.items (overall/home/road stats)
  raw jsonb, updated_at timestamptz NOT NULL DEFAULT now());

CREATE TABLE public.coaches (
  id bigint NOT NULL, team_id int NOT NULL REFERENCES public.teams(id), season int NOT NULL,
  first_name text, last_name text, role text NOT NULL DEFAULT 'Head Coach', experience int,
  updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (team_id, season, id));

CREATE TABLE public.players (
  id bigint PRIMARY KEY, full_name text NOT NULL, name_zh text,
  first_name text, last_name text, short_name text, slug text,
  team_id int REFERENCES public.teams(id),
  position text, position_name text, pos_group text CHECK (pos_group IN ('G','F','C')),
  jersey text, headshot_url text, is_active boolean NOT NULL DEFAULT true,
  height_in numeric, display_height text, weight_lb numeric, display_weight text,
  birth_date date, age int, birth_city text, birth_state text, birth_country text,
  college text, college_id int, experience_years int, debut_year int,
  draft_year int, draft_round int, draft_pick int, draft_team_id int, draft_display text,
  status text, injury_status text,                    -- roster injuries[0].status
  bio_raw jsonb,                                      -- roster athlete object (long tail)
  updated_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX players_team_idx ON public.players (team_id) WHERE is_active;
CREATE INDEX players_name_idx ON public.players (lower(full_name));

CREATE TABLE public.player_team_history (
  player_id bigint NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  team_id int NOT NULL REFERENCES public.teams(id),
  valid_from date NOT NULL, valid_to date, PRIMARY KEY (player_id, valid_from));

CREATE TABLE public.player_salaries (
  player_id bigint NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  season int NOT NULL, team_id int REFERENCES public.teams(id),
  salary bigint NOT NULL, source text NOT NULL DEFAULT 'espn',
  fetched_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (player_id, season, source));

CREATE TRIGGER teams_upd BEFORE UPDATE ON public.teams FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER players_upd BEFORE UPDATE ON public.players FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER venues_upd BEFORE UPDATE ON public.venues FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
