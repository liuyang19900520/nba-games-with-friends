"""
Command-line interface for NBA data synchronization.
Refactored to use new command structure with structured logging support.
"""
import argparse
import sys
from typing import Optional

from utils import SyncLogger
from services import (
    sync_teams,
    sync_team_standings,
    sync_team_season_advanced_stats,
    sync_active_players,
    sync_player_season_stats,
    sync_player_season_advanced_stats,
    sync_games,
    sync_game_details,
    sync_game_player_advanced_stats,
    sync_player_shots,
    sync_schedule_for_date,
    sync_schedule_for_date_range,
    sync_schedule_for_season,
)
from services.game_service import sync_single_game


def sync_teams_cmd(logger: SyncLogger) -> None:
    """Sync teams table."""
    logger.set_command("sync-teams")
    try:
        sync_teams()
        logger.complete(status="success", records_synced=None)  # Will be extracted from logs
    except Exception as e:
        logger.error(f"Failed to sync teams: {str(e)}")
        logger.complete(status="failed", error=str(e))
        raise


def sync_team_standings_cmd(logger: SyncLogger) -> None:
    """Sync team_standings table."""
    logger.set_command("sync-team-standings")
    try:
        sync_team_standings()
        logger.complete(status="success")
    except Exception as e:
        logger.error(f"Failed to sync team standings: {str(e)}")
        logger.complete(status="failed", error=str(e))
        raise


def sync_team_advanced_stats_cmd(logger: SyncLogger) -> None:
    """Sync team_season_advanced_stats table."""
    logger.set_command("sync-team-advanced-stats")
    try:
        sync_team_season_advanced_stats()
        logger.complete(status="success")
    except Exception as e:
        logger.error(f"Failed to sync team advanced stats: {str(e)}")
        logger.complete(status="failed", error=str(e))
        raise


def sync_players_cmd(logger: SyncLogger) -> None:
    """Sync players table."""
    logger.set_command("sync-players")
    try:
        sync_active_players()
        logger.complete(status="success")
    except Exception as e:
        logger.error(f"Failed to sync players: {str(e)}")
        logger.complete(status="failed", error=str(e))
        raise


def sync_player_stats_cmd(logger: SyncLogger) -> None:
    """Sync player_season_stats table."""
    logger.set_command("sync-player-stats")
    try:
        sync_player_season_stats()
        logger.complete(status="success")
    except Exception as e:
        logger.error(f"Failed to sync player stats: {str(e)}")
        logger.complete(status="failed", error=str(e))
        raise


def sync_player_advanced_stats_cmd(logger: SyncLogger) -> None:
    """Sync player_season_advanced_stats table."""
    logger.set_command("sync-player-advanced-stats")
    try:
        sync_player_season_advanced_stats()
        logger.complete(status="success")
    except Exception as e:
        logger.error(f"Failed to sync player advanced stats: {str(e)}")
        logger.complete(status="failed", error=str(e))
        raise


def sync_games_cmd(logger: SyncLogger) -> None:
    """Sync games table (default: yesterday and today)."""
    logger.set_command("sync-games")
    try:
        sync_games()
        logger.complete(status="success")
    except Exception as e:
        logger.error(f"Failed to sync games: {str(e)}")
        logger.complete(status="failed", error=str(e))
        raise


def sync_game_cmd(logger: SyncLogger, game_id: str) -> None:
    """
    Sync a single game (both games table and game_player_stats table).
    
    Args:
        logger: Logger instance
        game_id: NBA game ID (e.g., '0022500009')
    """
    logger.set_command("sync-game")
    try:
        logger.info(f"Syncing game {game_id} (games table + game_player_stats table)")
        sync_single_game(game_id)
        logger.complete(status="success", game_id=game_id)
    except Exception as e:
        logger.error(f"Failed to sync game {game_id}: {str(e)}")
        logger.complete(status="failed", game_id=game_id, error=str(e))
        raise


def sync_player_shots_cmd(logger: SyncLogger, player_id: int, game_id: Optional[str] = None, season: Optional[str] = None) -> None:
    """
    Sync shot chart data (hot zones) for a player.
    
    Args:
        logger: Logger instance
        player_id: NBA player ID (e.g., 2544 for LeBron James)
        game_id: Optional NBA game ID. If provided, syncs shots for that game only.
        season: Optional NBA season in format 'YYYY-YY'. If None, uses current season.
    """
    logger.set_command("sync-player-shots")
    try:
        if game_id:
            logger.info(f"Syncing shot chart for player {player_id}, game {game_id}")
        else:
            season_str = season or "current season"
            logger.info(f"Syncing shot chart for player {player_id}, season {season_str}")
        
        sync_player_shots(player_id=player_id, game_id=game_id, season=season)
        logger.complete(status="success", player_id=player_id, game_id=game_id, season=season)
    except Exception as e:
        logger.error(f"Failed to sync shot chart for player {player_id}: {str(e)}")
        logger.complete(status="failed", player_id=player_id, error=str(e))
        raise


def sync_game_stats_cmd(logger: SyncLogger, game_id: str) -> None:
    """
    Sync game_player_stats table for a specific game.
    
    Args:
        logger: Logger instance
        game_id: NBA game ID (e.g., '0022500009')
    """
    logger.set_command("sync-game-stats")
    try:
        logger.info(f"Syncing game player stats for game {game_id}")
        sync_game_details(game_id=game_id)
        logger.complete(status="success", game_id=game_id)
    except Exception as e:
        logger.error(f"Failed to sync game stats for {game_id}: {str(e)}")
        logger.complete(status="failed", game_id=game_id, error=str(e))
        raise


def sync_game_advanced_stats_cmd(logger: SyncLogger, game_id: str) -> None:
    """
    Sync game_player_advanced_stats table for a specific game.
    
    Args:
        logger: Logger instance
        game_id: NBA game ID (e.g., '0022500009')
    """
    logger.set_command("sync-game-advanced-stats")
    try:
        logger.info(f"Syncing player advanced stats for game {game_id}")
        sync_game_player_advanced_stats(game_id=game_id)
        logger.complete(status="success", game_id=game_id)
    except Exception as e:
        logger.error(f"Failed to sync game advanced stats for {game_id}: {str(e)}")
        logger.complete(status="failed", game_id=game_id, error=str(e))
        raise


def sync_schedule_cmd(logger: SyncLogger, date_str: Optional[str] = None, start_date: Optional[str] = None, end_date: Optional[str] = None, season: Optional[str] = None) -> None:
    """
    Sync game schedule information (pre-game data: date, time, arena, status).
    
    Args:
        logger: Logger instance
        date_str: Single date in YYYY-MM-DD format (syncs that date only)
        start_date: Start date in YYYY-MM-DD format (for date range)
        end_date: End date in YYYY-MM-DD format (for date range)
        season: NBA season (e.g., '2024-25'). If None, uses current season.
    """
    logger.set_command("sync-schedule")
    try:
        if date_str:
            logger.info(f"Syncing schedule for date {date_str}")
            sync_schedule_for_date(date_str, season)
            logger.complete(status="success", date=date_str)
        elif start_date and end_date:
            logger.info(f"Syncing schedule for date range {start_date} to {end_date}")
            sync_schedule_for_date_range(start_date, end_date, season)
            logger.complete(status="success", start_date=start_date, end_date=end_date)
        elif season:
            logger.info(f"Syncing schedule for season {season}")
            sync_schedule_for_season(season)
            logger.complete(status="success", season=season)
        else:
            # Default: sync current season
            logger.info("Syncing schedule for current season")
            sync_schedule_for_season(season)
            logger.complete(status="success")
    except Exception as e:
        logger.error(f"Failed to sync schedule: {str(e)}")
        logger.complete(status="failed", error=str(e))
        raise


def sync_game_date_cmd(logger: SyncLogger, date_str: str, with_stats: bool = False) -> None:
    """
    Sync all games for a specific date.
    
    Args:
        logger: Logger instance
        date_str: Date string in YYYY-MM-DD format (e.g., '2025-01-06')
        with_stats: If True, also sync player stats for completed games
    """
    logger.set_command("sync-game")
    try:
        if with_stats:
            logger.info(f"Syncing all games and player stats for date {date_str}")
        else:
            logger.info(f"Syncing all games for date {date_str}")
        from services.game_service import sync_games_for_date
        sync_games_for_date(date_str, sync_player_stats=with_stats)
        logger.complete(status="success", date=date_str)
    except Exception as e:
        logger.error(f"Failed to sync games for date {date_str}: {str(e)}")
        logger.complete(status="failed", date=date_str, error=str(e))
        raise


def parse_args() -> argparse.Namespace:
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(
        description='NBA Data Synchronization CLI',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Sync teams
  python cli.py sync-teams

  # Sync players
  python cli.py sync-players

  # Sync a single game (games + game_player_stats)
  python cli.py sync-game --game-id 0022500009
  python cli.py sync-game-id 0022500009  # Shortcut alias

  # Sync all games for a specific date
  python cli.py sync-game --date 2025-01-06

  # Sync all games and player stats for a specific date
  python cli.py sync-game --date 2025-01-06 --with-stats

  # Sync only game player stats
  python cli.py sync-game-stats --game-id 0022500009

  # JSON output mode
  python cli.py sync-teams --json

Available commands:
  sync-teams                 - Sync teams table
  sync-team-standings        - Sync team_standings table
  sync-team-advanced-stats   - Sync team_season_advanced_stats table (team advanced stats)
  sync-players               - Sync players table
  sync-player-stats          - Sync player_season_stats table (basic stats)
  sync-player-advanced-stats - Sync player_season_advanced_stats table (advanced stats)
  sync-player-shots          - Sync player_shots table (shot chart / hot zones)
  sync-games                 - Sync games table (yesterday + today)
  sync-game                  - Sync games: use --game-id for single game, or --date for all games on a date
  sync-game-id               - Alias for sync-game (shortcut: sync-game-id <game_id>)
  sync-game-stats            - Sync game_player_stats for a game (requires game-id)
  sync-game-advanced-stats   - Sync game_player_advanced_stats for a game (requires game-id)
  sync-schedule               - Sync game schedule (pre-game data: date, time, arena, status)
                                Use --date for single date, --start-date/--end-date for range, or --season for entire season
        """
    )
    
    # Global options
    parser.add_argument(
        '--json',
        action='store_true',
        help='Output logs in JSON format (for programmatic extraction)'
    )
    
    # Subcommands
    subparsers = parser.add_subparsers(dest='command', help='Sync command to execute')
    
    # Helper function to add --json to subcommands
    def add_json_arg(subparser):
        subparser.add_argument('--json', action='store_true', help='Output logs in JSON format')
    
    # sync-teams
    teams_parser = subparsers.add_parser('sync-teams', help='Sync teams table')
    add_json_arg(teams_parser)
    
    # sync-team-standings
    standings_parser = subparsers.add_parser('sync-team-standings', help='Sync team_standings table')
    add_json_arg(standings_parser)
    
    # sync-team-advanced-stats
    team_adv_stats_parser = subparsers.add_parser('sync-team-advanced-stats', help='Sync team_season_advanced_stats table')
    add_json_arg(team_adv_stats_parser)
    
    # sync-players
    players_parser = subparsers.add_parser('sync-players', help='Sync players table')
    add_json_arg(players_parser)
    
    # sync-player-stats
    stats_parser = subparsers.add_parser('sync-player-stats', help='Sync player_season_stats table')
    add_json_arg(stats_parser)
    
    # sync-player-advanced-stats
    advanced_stats_parser = subparsers.add_parser('sync-player-advanced-stats', help='Sync player_season_advanced_stats table')
    add_json_arg(advanced_stats_parser)
    
    # sync-player-shots (shot chart / hot zones)
    shots_parser = subparsers.add_parser('sync-player-shots', help='Sync player shot chart data (hot zones) for a player')
    shots_parser.add_argument(
        '--player-id',
        type=int,
        required=False,
        help='NBA player ID (e.g., 2544 for LeBron James). Required if not provided as positional argument.'
    )
    shots_parser.add_argument(
        '--game-id',
        type=str,
        required=False,
        help='Optional NBA game ID. If provided, syncs shots for that game only. Otherwise syncs all shots for the season.'
    )
    shots_parser.add_argument(
        '--season',
        type=str,
        required=False,
        help='NBA season in format YYYY-YY (e.g., 2024-25). If not provided, uses current season.'
    )
    shots_parser.add_argument(
        'player_id_pos',  # Positional argument as alternative
        nargs='?',
        type=int,
        help='NBA player ID (alternative to --player-id)'
    )
    add_json_arg(shots_parser)
    
    # sync-games
    games_parser = subparsers.add_parser('sync-games', help='Sync games table (yesterday + today)')
    add_json_arg(games_parser)
    
    # sync-game (supports --game-id or --date)
    sync_game_parser = subparsers.add_parser('sync-game', help='Sync games: use --game-id for single game, or --date for all games on a date')
    sync_game_parser.add_argument(
        '--game-id',
        type=str,
        required=False,
        help='NBA game ID (e.g., 0022500009). Mutually exclusive with --date.'
    )
    sync_game_parser.add_argument(
        '--date',
        type=str,
        required=False,
        help='Date in YYYY-MM-DD format (e.g., 2025-01-06). Syncs all games for this date. Mutually exclusive with --game-id.'
    )
    sync_game_parser.add_argument(
        '--with-stats',
        action='store_true',
        help='When syncing by date, also sync player stats for completed games (status=Final). Only works with --date.'
    )
    sync_game_parser.add_argument(
        'game_id_pos',  # Positional argument as alternative
        nargs='?',
        type=str,
        help='NBA game ID (alternative to --game-id, mutually exclusive with --date)'
    )
    
    # sync-game-stats (requires --game-id)
    sync_game_stats_parser = subparsers.add_parser('sync-game-stats', help='Sync game_player_stats for a game')
    sync_game_stats_parser.add_argument(
        '--game-id',
        type=str,
        required=False,  # Made optional to support positional argument
        help='NBA game ID (e.g., 0022500009)'
    )
    sync_game_stats_parser.add_argument(
        'game_id_pos',  # Positional argument as alternative
        nargs='?',
        type=str,
        help='NBA game ID (alternative to --game-id)'
    )
    
    # sync-game-advanced-stats (requires --game-id)
    sync_game_adv_stats_parser = subparsers.add_parser('sync-game-advanced-stats', help='Sync game_player_advanced_stats for a game')
    sync_game_adv_stats_parser.add_argument(
        '--game-id',
        type=str,
        required=False,  # Made optional to support positional argument
        help='NBA game ID (e.g., 0022500009)'
    )
    sync_game_adv_stats_parser.add_argument(
        'game_id_pos',  # Positional argument as alternative
        nargs='?',
        type=str,
        help='NBA game ID (alternative to --game-id)'
    )
    add_json_arg(sync_game_adv_stats_parser)
    
    # Add alias: sync-game-id (shortcut for sync-game)
    sync_game_id_parser = subparsers.add_parser('sync-game-id', help='Alias for sync-game (sync a single game)')
    sync_game_id_parser.add_argument(
        'game_id',
        type=str,
        help='NBA game ID (e.g., 0022500009)'
    )
    # Add --json support to game-related subcommands
    add_json_arg(sync_game_parser)
    add_json_arg(sync_game_stats_parser)
    add_json_arg(sync_game_id_parser)
    
    # sync-schedule (for pre-game schedule information)
    schedule_parser = subparsers.add_parser('sync-schedule', help='Sync game schedule (pre-game data: date, time, arena, status)')
    schedule_parser.add_argument(
        '--date',
        type=str,
        required=False,
        help='Single date in YYYY-MM-DD format (syncs that date only)'
    )
    schedule_parser.add_argument(
        '--start-date',
        type=str,
        required=False,
        help='Start date in YYYY-MM-DD format (for date range, requires --end-date)'
    )
    schedule_parser.add_argument(
        '--end-date',
        type=str,
        required=False,
        help='End date in YYYY-MM-DD format (for date range, requires --start-date)'
    )
    schedule_parser.add_argument(
        '--season',
        type=str,
        required=False,
        help='NBA season in format YYYY-YY (e.g., 2024-25). If not provided, uses current season. If no date options provided, syncs entire season.'
    )
    add_json_arg(schedule_parser)
    
    args = parser.parse_args()
    
    # Validate that a command was provided
    if not args.command:
        parser.print_help()
        sys.exit(1)
    
    return args


def main() -> int:
    """Main CLI entry point."""
    args = parse_args()
    
    # Initialize logger - --json can be at global or subcommand level
    json_mode = getattr(args, 'json', False)
    logger = SyncLogger(json_mode=json_mode)
    
    try:
        # Route to appropriate command
        if args.command == 'sync-teams':
            sync_teams_cmd(logger)
        elif args.command == 'sync-team-standings':
            sync_team_standings_cmd(logger)
        elif args.command == 'sync-team-advanced-stats':
            sync_team_advanced_stats_cmd(logger)
        elif args.command == 'sync-players':
            sync_players_cmd(logger)
        elif args.command == 'sync-player-stats':
            sync_player_stats_cmd(logger)
        elif args.command == 'sync-player-advanced-stats':
            sync_player_advanced_stats_cmd(logger)
        elif args.command == 'sync-player-shots':
            # Support both --player-id and positional argument
            player_id = args.player_id or getattr(args, 'player_id_pos', None)
            if not player_id:
                logger.error("Player ID is required for sync-player-shots command. Use --player-id or provide as positional argument.")
                return 1
            game_id = getattr(args, 'game_id', None)
            season = getattr(args, 'season', None)
            sync_player_shots_cmd(logger, player_id, game_id, season)
        elif args.command == 'sync-games':
            sync_games_cmd(logger)
        elif args.command == 'sync-game':
            # Support --game-id, positional argument, or --date
            game_id = args.game_id or getattr(args, 'game_id_pos', None)
            date_str = getattr(args, 'date', None)
            with_stats = getattr(args, 'with_stats', False)
            
            # Check if user mistakenly used --with stats instead of --with-stats
            if game_id and game_id.lower() == 'stats' and date_str:
                logger.error("Invalid argument: 'stats' was interpreted as a game ID.")
                logger.error("Did you mean to use '--with-stats' (with a hyphen)?")
                logger.error("Correct usage: python cli.py sync-game --date 2025-12-26 --with-stats")
                return 1
            
            # Validate that exactly one of game_id or date is provided
            if game_id and date_str:
                logger.error("Cannot specify both --game-id and --date. Use one or the other.")
                return 1
            if not game_id and not date_str:
                logger.error("Either --game-id (or positional game_id) or --date is required for sync-game command.")
                return 1
            
            # Validate --with-stats can only be used with --date
            if with_stats and not date_str:
                logger.error("--with-stats can only be used with --date option.")
                return 1
            
            if date_str:
                # Sync all games for the specified date
                sync_game_date_cmd(logger, date_str, with_stats=with_stats)
            else:
                # Sync a single game by ID (always includes stats)
                sync_game_cmd(logger, game_id)
        elif args.command == 'sync-game-stats':
            # Support both --game-id and positional argument
            game_id = args.game_id or getattr(args, 'game_id_pos', None)
            if not game_id:
                logger.error("Game ID is required for sync-game-stats command. Use --game-id or provide as positional argument.")
                return 1
            sync_game_stats_cmd(logger, game_id)
        elif args.command == 'sync-game-advanced-stats':
            # Support both --game-id and positional argument
            game_id = args.game_id or getattr(args, 'game_id_pos', None)
            if not game_id:
                logger.error("Game ID is required for sync-game-advanced-stats command. Use --game-id or provide as positional argument.")
                return 1
            sync_game_advanced_stats_cmd(logger, game_id)
        elif args.command == 'sync-game-id':
            # Alias for sync-game
            game_id = getattr(args, 'game_id', None)
            if not game_id:
                logger.error("Game ID is required for sync-game-id command")
                return 1
            sync_game_cmd(logger, game_id)
        elif args.command == 'sync-schedule':
            date_str = getattr(args, 'date', None)
            start_date = getattr(args, 'start_date', None)
            end_date = getattr(args, 'end_date', None)
            season = getattr(args, 'season', None)
            
            # Validate arguments
            if date_str and (start_date or end_date):
                logger.error("Cannot specify both --date and --start-date/--end-date. Use one or the other.")
                return 1
            
            if (start_date and not end_date) or (end_date and not start_date):
                logger.error("Both --start-date and --end-date are required for date range.")
                return 1
            
            sync_schedule_cmd(logger, date_str, start_date, end_date, season)
        else:
            logger.error(f"Unknown command: {args.command}")
            return 1
        
        # Get summary
        summary = logger.get_summary()
        if not args.json:
            print("\n" + "=" * 60)
            print("Sync Summary")
            print("=" * 60)
            print(f"Command: {summary.get('command', 'unknown')}")
            print(f"Status: {summary.get('status', 'unknown')}")
            if summary.get('duration_seconds'):
                print(f"Duration: {summary['duration_seconds']}s")
            if summary.get('records_synced'):
                print(f"Records synced: {summary['records_synced']}")
            if summary.get('error_count', 0) > 0:
                print(f"Errors: {summary['error_count']}")
                for error in summary.get('errors', []):
                    print(f"  - {error}")
        
        return 0 if summary.get('status') == 'success' else 1
        
    except KeyboardInterrupt:
        if not args.json:
            logger.warning("Interrupted by user")
        return 130
    except Exception as e:
        logger.error(f"Fatal error: {str(e)}")
        if not args.json:
            import traceback
            traceback.print_exc()
        return 1


if __name__ == "__main__":
    try:
        exit_code = main()
        sys.exit(exit_code)
    except KeyboardInterrupt:
        print("\n\n⚠️ Interrupted by user")
        sys.exit(130)
    except Exception as e:
        print(f"\n❌ Fatal error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
