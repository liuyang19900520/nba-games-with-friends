"""
Command-line interface for NBA data synchronization.
Allows manual control over which data to sync.
"""
import argparse
import sys
from typing import List

from services import (
    sync_teams,
    sync_team_standings,
    sync_active_players,
    sync_player_season_stats,
    sync_games,
    sync_game_details,
)


def sync_teams_cmd() -> None:
    """Sync teams data."""
    print("=" * 60)
    print("Syncing Teams")
    print("=" * 60)
    sync_teams()


def sync_team_standings_cmd() -> None:
    """Sync team standings data."""
    print("=" * 60)
    print("Syncing Team Standings")
    print("=" * 60)
    sync_team_standings()


def sync_players_cmd() -> None:
    """Sync players data."""
    print("=" * 60)
    print("Syncing Players")
    print("=" * 60)
    sync_active_players()


def sync_stats_cmd() -> None:
    """Sync player season stats data."""
    print("=" * 60)
    print("Syncing Player Season Stats")
    print("=" * 60)
    sync_player_season_stats()


def sync_games_cmd() -> None:
    """Sync games data."""
    print("=" * 60)
    print("Syncing Games")
    print("=" * 60)
    sync_games()


def sync_game_details_cmd(game_id: str) -> None:
    """Sync game player stats for a specific game."""
    print("=" * 60)
    print(f"Syncing Game Player Stats for Game {game_id}")
    print("=" * 60)
    sync_game_details(game_id=game_id)


# Mapping of command names to functions
# Note: game-player-stats is handled specially in main() because it requires --game-id argument
SYNC_COMMANDS = {
    'teams': sync_teams_cmd,
    'team-standings': sync_team_standings_cmd,
    'players': sync_players_cmd,
    'stats': sync_stats_cmd,
    'games': sync_games_cmd,
    # 'game-player-stats' is handled separately in main() due to required --game-id argument
}


def parse_args() -> argparse.Namespace:
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(
        description='NBA Data Synchronization CLI',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Sync only teams
  python cli.py teams

  # Sync teams and players
  python cli.py teams players

  # Sync all data
  python cli.py --all

  # Sync games only
  python cli.py games

Available sync commands:
  teams              - Sync teams table (static team info)
  team-standings     - Sync team standings table (wins, losses, etc.)
  players            - Sync players table (active players)
  stats              - Sync player season stats table
  games              - Sync games table (schedule and results)
  game-player-stats  - Sync game player stats for a specific game (requires --game-id)
        """
    )
    
    parser.add_argument(
        'commands',
        nargs='*',
        help='Sync commands to execute (can specify multiple). Use --list to see available commands.'
    )
    
    parser.add_argument(
        '--all',
        action='store_true',
        help='Sync all data (teams, team-standings, players, stats, games)'
    )
    
    parser.add_argument(
        '--list',
        action='store_true',
        help='List all available sync commands and exit'
    )
    
    parser.add_argument(
        '--game-id',
        type=str,
        help='Game ID for syncing game player stats (required for game-player-stats command)'
    )
    
    args = parser.parse_args()
    
    # Validate commands if provided (but not if --list is used)
    if not args.list and args.commands:
        valid_commands = list(SYNC_COMMANDS.keys()) + ['all', 'game-player-stats']
        invalid = [cmd for cmd in args.commands if cmd not in valid_commands]
        if invalid:
            parser.error(f"Invalid command(s): {', '.join(invalid)}. Use --list to see available commands.")
    
    return args


def list_commands() -> None:
    """List all available sync commands."""
    print("Available sync commands:")
    print()
    for cmd, func in SYNC_COMMANDS.items():
        print(f"  {cmd:20} - {func.__doc__}")
    print()
    print("  game-player-stats  - Sync player stats for a specific game (requires --game-id)")
    print()
    print("Examples:")
    print("  python cli.py teams players games")
    print("  python cli.py game-player-stats --game-id 0022500009")
    print("  python cli.py --all")


def main() -> int:
    """Main CLI entry point."""
    args = parse_args()
    
    # Handle --list flag
    if args.list:
        list_commands()
        return 0
    
    # Determine which commands to execute
    commands_to_run: List[str] = []
    
    if args.all:
        # Sync all commands
        commands_to_run = list(SYNC_COMMANDS.keys())
    elif args.commands:
        # Use specified commands
        if 'all' in args.commands:
            commands_to_run = list(SYNC_COMMANDS.keys())
        else:
            commands_to_run = args.commands
    else:
        # No commands specified, show help
        print("Error: No sync commands specified.")
        print("Use --help for usage information, or --list to see available commands.")
        return 1
    
    # Execute commands
    if not commands_to_run:
        print("No commands to execute.")
        return 1
    
    # Special handling for game-player-stats command
    if 'game-player-stats' in commands_to_run:
        if not args.game_id:
            print("❌ Error: --game-id is required for game-player-stats command")
            print("Example: python cli.py game-player-stats --game-id 0022500009")
            return 1
    
    print("=" * 60)
    print("NBA Data Synchronization CLI")
    print("=" * 60)
    print(f"Commands to execute: {', '.join(commands_to_run)}")
    if args.game_id:
        print(f"Game ID: {args.game_id}")
    print("=" * 60)
    print()
    
    failed_commands = []
    
    for i, cmd in enumerate(commands_to_run, 1):
        try:
            print(f"\n[{i}/{len(commands_to_run)}] Executing: {cmd}")
            print("-" * 60)
            
            # Special handling for game-player-stats
            if cmd == 'game-player-stats':
                sync_game_details_cmd(args.game_id)
            else:
                SYNC_COMMANDS[cmd]()
            
            print(f"\n✅ {cmd} completed successfully")
        except KeyboardInterrupt:
            print(f"\n⚠️ Interrupted by user during {cmd}")
            return 130  # Standard exit code for Ctrl+C
        except Exception as e:
            print(f"\n❌ Error during {cmd}: {e}")
            import traceback
            traceback.print_exc()
            failed_commands.append(cmd)
            
            # Ask if user wants to continue
            if i < len(commands_to_run):
                response = input(f"\nContinue with remaining commands? (y/n): ").strip().lower()
                if response != 'y':
                    print("Aborted by user.")
                    return 1
    
    # Summary
    print("\n" + "=" * 60)
    print("Sync Summary")
    print("=" * 60)
    print(f"Total commands executed: {len(commands_to_run)}")
    print(f"Successful: {len(commands_to_run) - len(failed_commands)}")
    if failed_commands:
        print(f"Failed: {len(failed_commands)}")
        print(f"Failed commands: {', '.join(failed_commands)}")
        return 1
    else:
        print("✅ All commands completed successfully!")
        return 0


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

