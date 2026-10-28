# nba v2 final schema test (PGlite, updated 2026-10-28 23:15 JST) — v2b: store everything ESPN gives; no fantasy scoring

Harness: nba-sync/schema-test.mjs. Schema = nba-v2-schema-final.sql = concat of migrations/2026102800000{1..6}_*.sql (core_reference, games, season_stats, app, views, rls). '(expect ERR)' lines are intended rejections.

```
OK  stub auth
OK  schema
OK  grants
OK  seed 2 users/2 teams/4 players/2 games -> [{"profiles_auto":2}]
OK  user1 creates group + lineup -> [{"picks":4}]
OK  user2 sees nothing of group -> [{"g":0,"l":0}]
ERR user2 writes into user1 lineup (expect ERR): new row violates row-level security policy for table "lineup_players"
OK  anon reads players -> [{"count":4}]
OK  tip-off game 100
ERR swap locked player (expect ERR): player 1 locked: game 100 tipped off at 2026-10-28 14:07:27.258+00
ERR delete locked player (expect ERR): player 2 locked: game 100 tipped off at 2026-10-28 14:07:27.258+00
OK  edit unlocked pick (game 101) OK -> [{"slot":"F2"}]
ERR wrong-day/not-in-game pick (expect ERR): duplicate key value violates unique constraint "lineup_players_lineup_id_player_id_key"
OK  final stats (raw box score) -> [{"n":2}]
OK  game 101 final -> [{"player_id":1,"pts":30},{"player_id":2,"pts":12},{"player_id":3,"pts":20},{"player_id":4,"pts":null}]
OK  box season averages view (anon) -> [{"player_id":1,"gp":1,"min":"36.0","pts":"30.0","reb":"5.0","oreb":"1.0","dreb":"4.0","ast":"8.0","fg_pct":"55.0","fg3_pct":"44.4","ts_pct":"67.6","efg_pct":"65.0","ast_to":"2.67","dd2":0},{"player_id":2,"gp":1,"min":"30.0","pts":"12.0","reb":"14.0","oreb":"4.0","dreb":"10.0","ast":"2.0","fg_pct":"55.6","fg3_pct":null,"ts_pct":"55.8","efg_pct":"55.6","ast_to":"1.00","dd2":1},{"player_id":3,"gp":1,"min":"34.0","pts":"20.0","reb":"4.0","oreb":null,"dreb":null,"ast":"6.0","fg_pct":"46.7","fg3_pct":"33.3","ts_pct":"59.7","efg_pct":"53.3","ast_to":"6.00","dd2":0}]
OK  ESPN core row overrides box row in player_season_stats -> [{"player_id":1,"source":"box","pts":"30.0","per":null},{"player_id":2,"source":"espn","pts":"12.0","per":"25.1"},{"player_id":3,"source":"box","pts":"20.0","per":null}]
OK  league ranks (rank() window, qualified) -> [{"player_id":1,"qualified":true,"pts_rank":1,"reb_rank":2,"fg_pct_rank":2,"per_rank":null,"pts_total_rank":1},{"player_id":2,"qualified":true,"pts_rank":3,"reb_rank":1,"fg_pct_rank":1,"per_rank":1,"pts_total_rank":null},{"player_id":3,"qualified":true,"pts_rank":2,"reb_rank":3,"fg_pct_rank":3,"per_rank":null,"pts_total_rank":2}]
OK  team zh + position zh seeded -> [{"teams_zh":30,"lal":"洛杉矶湖人","pos":9}]
OK  game children cascade -> [{"periods":2,"plays":1}]
ERR anon cannot write reference data (expect ERR): permission denied for table injuries
OK  no scoring objects remain -> [{"objs":"espn_raw_endpoint_resource_key_sha256_key"}]
OK  no scoring functions remain -> [{"n":0}]
OK  user2 joins by invite, sees lineup -> [{"count":4}]
```

Result: all steps behave as expected. New in v2b: tables venues, coaches, team_i18n (30 zh team names), position_i18n, standings, injuries, team_season_stats, player_season_stats_espn, game_periods, game_team_stats, game_officials, game_broadcasts, game_odds, game_plays, game_win_probability; views player_box_season_totals/averages (from box scores), player_season_stats (ESPN core row preferred, box fallback), player_season_ranks (rank() per stat; NULL rank when not qualified or value NULL). Lineup lock + RLS unchanged. Full sync on a real ESPN dataset: see nba-sync/RUN-LOG.md.
