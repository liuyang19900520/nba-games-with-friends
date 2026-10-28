-- 6/6 RLS. Writes to reference/ingest tables only via service_role (bypasses RLS).
CREATE OR REPLACE FUNCTION public.is_group_member(g bigint) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS
$$ SELECT EXISTS (SELECT 1 FROM group_members WHERE group_id = g AND user_id = auth.uid()) $$;

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['ingest_jobs','espn_raw','team_i18n','position_i18n','venues','teams','coaches','players','player_team_history','player_salaries',
    'games','game_periods','game_team_stats','player_game_stats','game_officials','game_broadcasts','game_odds','game_plays','game_win_probability',
    'standings','injuries','team_season_stats','player_season_stats_espn','profiles','groups','group_members',
    'contests','lineups','lineup_players'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
  -- public read reference data (anon + authenticated); ingest_jobs/espn_raw: no policy = service_role only
  FOREACH t IN ARRAY ARRAY['team_i18n','position_i18n','venues','teams','coaches','players','player_team_history','player_salaries',
    'games','game_periods','game_team_stats','player_game_stats','game_officials','game_broadcasts','game_odds','game_plays','game_win_probability',
    'standings','injuries','team_season_stats','player_season_stats_espn','contests'] LOOP
    EXECUTE format('CREATE POLICY read_all ON public.%I FOR SELECT USING (true)', t);
  END LOOP;
END $$;

CREATE POLICY profiles_read ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY profiles_self ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY groups_read ON public.groups FOR SELECT TO authenticated USING (public.is_group_member(id) OR owner_id = auth.uid());
CREATE POLICY groups_ins ON public.groups FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY groups_upd ON public.groups FOR UPDATE TO authenticated USING (owner_id = auth.uid());
CREATE POLICY groups_del ON public.groups FOR DELETE TO authenticated USING (owner_id = auth.uid());

CREATE POLICY gm_read ON public.group_members FOR SELECT TO authenticated USING (public.is_group_member(group_id));
CREATE POLICY gm_leave ON public.group_members FOR DELETE TO authenticated USING (user_id = auth.uid());
-- joining by invite code goes through join_group() below

CREATE OR REPLACE FUNCTION public.join_group(p_code text) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE g bigint; BEGIN
  SELECT id INTO g FROM groups WHERE invite_code = p_code;
  IF g IS NULL THEN RAISE EXCEPTION 'invalid invite code'; END IF;
  INSERT INTO group_members (group_id, user_id) VALUES (g, auth.uid()) ON CONFLICT DO NOTHING;
  RETURN g; END $$;

-- lineups: group members see each other's lineups (picks visible); only owner writes
CREATE POLICY lineups_read ON public.lineups FOR SELECT TO authenticated USING (public.is_group_member(group_id));
CREATE POLICY lineups_ins ON public.lineups FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_group_member(group_id));
CREATE POLICY lineups_del ON public.lineups FOR DELETE TO authenticated USING (user_id = auth.uid()
  AND NOT EXISTS (SELECT 1 FROM public.lineup_players i JOIN public.games g ON g.id = i.game_id
                  WHERE i.lineup_id = lineups.id AND g.tipoff_at <= now()));

CREATE POLICY lp_read ON public.lineup_players FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.lineups l WHERE l.id = lineup_id AND public.is_group_member(l.group_id)));
CREATE POLICY lp_write ON public.lineup_players FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.lineups l WHERE l.id = lineup_id AND l.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.lineups l WHERE l.id = lineup_id AND l.user_id = auth.uid()));
