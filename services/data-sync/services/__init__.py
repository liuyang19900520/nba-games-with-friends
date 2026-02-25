"""
Services package for NBA data synchronization.

Each service handles synchronization for a specific table:
- team_service: Syncs teams table
- team_standings_service: Syncs team_standings table
- team_advanced_stats_service: Syncs team_season_advanced_stats table
- player_service: Syncs players table
- stats_service: Syncs player_season_stats table
- advanced_stats_service: Syncs player_season_advanced_stats table
- game_service: Syncs games table (legacy, for stats)
- schedule_service: Syncs games table with schedule information (pre-game data: date, time, arena)
- game_player_stats_service: Syncs game_player_stats table
- game_player_advanced_stats_service: Syncs game_player_advanced_stats table
- shot_service: Syncs player_shots table
"""
from .team_service import sync_teams
from .team_standings_service import sync_team_standings
from .team_advanced_stats_service import sync_team_season_advanced_stats
from .player_service import sync_active_players
from .stats_service import sync_player_season_stats
from .advanced_stats_service import sync_player_season_advanced_stats
from .game_service import sync_games, sync_single_game, sync_games_for_date
from .schedule_service import sync_schedule_for_date, sync_schedule_for_date_range, sync_schedule_for_season
from .game_player_stats_service import sync_game_details
from .game_player_advanced_stats_service import sync_game_player_advanced_stats
from .shot_service import sync_player_shots

__all__ = [
    'sync_teams',
    'sync_team_standings',
    'sync_team_season_advanced_stats',
    'sync_active_players',
    'sync_player_season_stats',
    'sync_player_season_advanced_stats',
    'sync_games',
    'sync_single_game',
    'sync_games_for_date',
    'sync_schedule_for_date',
    'sync_schedule_for_date_range',
    'sync_schedule_for_season',
    'sync_game_details',
    'sync_game_player_advanced_stats',
    'sync_player_shots',
]

