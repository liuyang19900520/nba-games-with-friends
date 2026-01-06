"""
Command-line interface for NBA data synchronization.
Refactored to use new command structure with structured logging support.
"""
import argparse
import sys
from typing import Optional

from app.utils.logger import SyncLogger
from services import (
    sync_teams,
    sync_team_standings,
    sync_active_players,
    sync_player_season_stats,
    sync_games,
    sync_game_details,
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
  sync-teams          - Sync teams table
  sync-team-standings - Sync team_standings table
  sync-players        - Sync players table
  sync-player-stats   - Sync player_season_stats table
  sync-games          - Sync games table (yesterday + today)
  sync-game           - Sync games: use --game-id for single game, or --date for all games on a date
  sync-game-id        - Alias for sync-game (shortcut: sync-game-id <game_id>)
  sync-game-stats     - Sync game_player_stats for a game (requires game-id)
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
    
    # sync-players
    players_parser = subparsers.add_parser('sync-players', help='Sync players table')
    add_json_arg(players_parser)
    
    # sync-player-stats
    stats_parser = subparsers.add_parser('sync-player-stats', help='Sync player_season_stats table')
    add_json_arg(stats_parser)
    
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
        elif args.command == 'sync-players':
            sync_players_cmd(logger)
        elif args.command == 'sync-player-stats':
            sync_player_stats_cmd(logger)
        elif args.command == 'sync-games':
            sync_games_cmd(logger)
        elif args.command == 'sync-game':
            # Support --game-id, positional argument, or --date
            game_id = args.game_id or getattr(args, 'game_id_pos', None)
            date_str = getattr(args, 'date', None)
            with_stats = getattr(args, 'with_stats', False)
            
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
        elif args.command == 'sync-game-id':
            # Alias for sync-game
            game_id = getattr(args, 'game_id', None)
            if not game_id:
                logger.error("Game ID is required for sync-game-id command")
                return 1
            sync_game_cmd(logger, game_id)
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
