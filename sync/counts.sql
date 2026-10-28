SELECT 'teams' t, count(*) FROM teams UNION ALL SELECT 'players', count(*) FROM players UNION ALL SELECT 'player_team_history', count(*) FROM player_team_history
UNION ALL SELECT 'player_salaries', count(*) FROM player_salaries UNION ALL SELECT 'games', count(*) FROM games UNION ALL SELECT 'player_game_stats', count(*) FROM player_game_stats UNION ALL SELECT 'player_season_averages', count(*) FROM player_season_averages
UNION ALL SELECT 'espn_raw', count(*) FROM espn_raw UNION ALL SELECT 'ingest_jobs', count(*) FROM ingest_jobs;
