"""
NBA Data Backfill Script
========================
Comprehensive data repair tool for the 2025-26 season.

All times are displayed in Tokyo Time (JST, UTC+9).

Features:
- Smart detection of missing data
- Rate limiting with jitter to avoid NBA API throttling (important!)
- Checkpoint/resume support
- Progress tracking with ETA
- Detailed logging

RATE LIMITING NOTICE:
  The NBA API enforces rate limits (~20-30 requests/minute).
  This script uses conservative delays with random jitter to avoid triggering limits.
  If you encounter 429 errors, increase the DELAY constants below.

Usage:
    cd py-data-sync-service
    python check-data/backfill_data.py --check          # Dry run
    python check-data/backfill_data.py --phase1         # Sync games + stats
    python check-data/backfill_data.py --phase2         # Sync aggregates
    python check-data/backfill_data.py --all            # Run all phases
    python check-data/backfill_data.py --resume         # Resume from checkpoint
"""
import os
import sys
import json
import time
import random
import argparse
from datetime import datetime, timedelta
from typing import List, Set, Dict, Optional
from dotenv import load_dotenv
import pytz

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env.development'))

from supabase import create_client

# Import sync functions from parent directory
from services import (
    sync_games_for_date,
    sync_game_details,
    sync_game_player_advanced_stats,
    sync_player_season_stats,
    sync_player_season_advanced_stats,
    sync_team_standings,
    sync_team_season_advanced_stats,
)

# Configuration
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

# Timezone: Tokyo (JST)
TOKYO_TZ = pytz.timezone('Asia/Tokyo')

SEASON = "2025-26"
SEASON_START = "2025-10-22"
TODAY = datetime.now(TOKYO_TZ).strftime("%Y-%m-%d")

# ============================================================================
# RATE LIMITING CONFIGURATION (AGGRESSIVE)
# ============================================================================
# NBA API enforces strict rate limits (~20-30 requests per minute).
# This script uses CONSERVATIVE delays with jitter to avoid blocking.
#
# ERROR SIGNS:
#   - RemoteDisconnected: Server closed connection (rate limited!)
#   - ReadTimeout: Request timed out (might be rate limited)
#   - 429 Too Many Requests: Explicit rate limit
#
# If you encounter these errors:
#   1. Wait 5-10 minutes before resuming
#   2. Increase the delay values below
#   3. Use --resume to continue from checkpoint
#
# RECOMMENDED VALUES if rate limited:
#   DELAY_BETWEEN_DATES: 8.0-12.0 seconds
#   DELAY_BETWEEN_GAMES: 5.0-8.0 seconds
# ============================================================================
DELAY_BETWEEN_DATES_MIN = 5.0   # Minimum delay between date syncs
DELAY_BETWEEN_DATES_MAX = 8.0   # Maximum delay between date syncs
DELAY_BETWEEN_GAMES_MIN = 4.0   # Minimum delay between individual game syncs
DELAY_BETWEEN_GAMES_MAX = 6.0   # Maximum delay between individual game syncs
DELAY_BETWEEN_PHASES = 15.0     # Delay between major phases (fixed)

# For backwards compatibility
DELAY_BETWEEN_DATES = (DELAY_BETWEEN_DATES_MIN + DELAY_BETWEEN_DATES_MAX) / 2
DELAY_BETWEEN_GAMES = (DELAY_BETWEEN_GAMES_MIN + DELAY_BETWEEN_GAMES_MAX) / 2

# Checkpoint file for resume support (in check-data folder)
CHECKPOINT_FILE = os.path.join(os.path.dirname(__file__), "backfill_checkpoint.json")


def rate_limit_sleep(min_delay: float, max_delay: float, context: str = ""):
    """
    Sleep for a random duration between min_delay and max_delay.
    Adding jitter helps avoid triggering NBA API rate limit detection.
    """
    sleep_time = random.uniform(min_delay, max_delay)
    if context:
        # Only print occasionally to reduce noise
        pass  # Silent sleep
    time.sleep(sleep_time)


class BackfillProgress:
    """Track and persist backfill progress."""

    def __init__(self):
        self.completed_dates: Set[str] = set()
        self.completed_game_stats: Set[str] = set()
        self.completed_advanced_stats: Set[str] = set()
        self.phase1_complete = False
        self.phase2_complete = False
        self.start_time: Optional[float] = None
        self.load()

    def load(self):
        """Load progress from checkpoint file."""
        if os.path.exists(CHECKPOINT_FILE):
            try:
                with open(CHECKPOINT_FILE, 'r') as f:
                    data = json.load(f)
                    self.completed_dates = set(data.get('completed_dates', []))
                    self.completed_game_stats = set(data.get('completed_game_stats', []))
                    self.completed_advanced_stats = set(data.get('completed_advanced_stats', []))
                    self.phase1_complete = data.get('phase1_complete', False)
                    self.phase2_complete = data.get('phase2_complete', False)
                print(f"[Checkpoint] Loaded: {len(self.completed_dates)} dates, "
                      f"{len(self.completed_game_stats)} game stats, "
                      f"{len(self.completed_advanced_stats)} advanced stats")
            except Exception as e:
                print(f"[Checkpoint] Failed to load: {e}")

    def save(self):
        """Save progress to checkpoint file."""
        try:
            with open(CHECKPOINT_FILE, 'w') as f:
                json.dump({
                    'completed_dates': list(self.completed_dates),
                    'completed_game_stats': list(self.completed_game_stats),
                    'completed_advanced_stats': list(self.completed_advanced_stats),
                    'phase1_complete': self.phase1_complete,
                    'phase2_complete': self.phase2_complete,
                    'last_updated': datetime.now().isoformat()
                }, f, indent=2)
        except Exception as e:
            print(f"[Checkpoint] Failed to save: {e}")

    def mark_date_complete(self, date_str: str):
        self.completed_dates.add(date_str)
        self.save()

    def mark_game_stats_complete(self, game_id: str):
        self.completed_game_stats.add(game_id)
        # Save every 10 games to reduce I/O
        if len(self.completed_game_stats) % 10 == 0:
            self.save()

    def mark_advanced_stats_complete(self, game_id: str):
        self.completed_advanced_stats.add(game_id)
        if len(self.completed_advanced_stats) % 10 == 0:
            self.save()


def print_header(title: str):
    print()
    print("=" * 70)
    print(f"  {title}")
    print("=" * 70)


def print_progress(current: int, total: int, prefix: str = "", eta_seconds: Optional[float] = None):
    """Print progress bar."""
    pct = current / total * 100 if total > 0 else 0
    bar_len = 30
    filled = int(bar_len * current / total) if total > 0 else 0
    bar = "=" * filled + "-" * (bar_len - filled)

    eta_str = ""
    if eta_seconds is not None and eta_seconds > 0:
        if eta_seconds > 3600:
            eta_str = f" | ETA: {eta_seconds/3600:.1f}h"
        elif eta_seconds > 60:
            eta_str = f" | ETA: {eta_seconds/60:.1f}m"
        else:
            eta_str = f" | ETA: {eta_seconds:.0f}s"

    print(f"\r{prefix}[{bar}] {current}/{total} ({pct:.1f}%){eta_str}    ", end="", flush=True)


def get_dates_needing_sync(client, progress: BackfillProgress) -> List[str]:
    """Get list of dates that need game sync."""
    # Generate all dates from season start to today
    start = datetime.strptime(SEASON_START, "%Y-%m-%d")
    end = datetime.strptime(TODAY, "%Y-%m-%d")

    all_dates = []
    current = start
    while current <= end:
        date_str = current.strftime("%Y-%m-%d")
        if date_str not in progress.completed_dates:
            all_dates.append(date_str)
        current += timedelta(days=1)

    return all_dates


def get_games_needing_stats(client, progress: BackfillProgress) -> List[Dict]:
    """Get Final games that need player stats sync."""
    # Get all Final games
    result = client.table("games") \
        .select("id, game_datetime") \
        .eq("season", SEASON) \
        .eq("status", "Final") \
        .order("game_datetime") \
        .execute()

    final_games = result.data

    # Get games that already have stats
    result = client.table("game_player_stats").select("game_id").execute()
    games_with_stats = set(row['game_id'] for row in result.data)

    # Filter to games needing stats
    games_needing = []
    for g in final_games:
        if g['id'] not in games_with_stats and g['id'] not in progress.completed_game_stats:
            games_needing.append(g)

    return games_needing


def get_games_needing_advanced_stats(client, progress: BackfillProgress) -> List[Dict]:
    """Get Final games that need advanced stats sync."""
    # Get all Final games
    result = client.table("games") \
        .select("id, game_datetime") \
        .eq("season", SEASON) \
        .eq("status", "Final") \
        .order("game_datetime") \
        .execute()

    final_games = result.data

    # Get games that already have advanced stats
    result = client.table("game_player_advanced_stats").select("game_id").execute()
    games_with_stats = set(row['game_id'] for row in result.data)

    # Filter to games needing stats
    games_needing = []
    for g in final_games:
        if g['id'] not in games_with_stats and g['id'] not in progress.completed_advanced_stats:
            games_needing.append(g)

    return games_needing


def get_orphaned_scheduled_games(client) -> List[Dict]:
    """
    Get games that are stuck in 'Scheduled' status but game_datetime is in the past.
    These games should have been played and need to be re-synced to get correct status.

    IMPORTANT: All games before today should be 'Final' (or 'Postponed'/'Cancelled').
    """
    # Use Tokyo timezone for today boundary
    today_start = datetime.now(TOKYO_TZ).strftime("%Y-%m-%d") + "T00:00:00+09:00"

    result = client.table("games") \
        .select("id, game_datetime, status") \
        .eq("season", SEASON) \
        .eq("status", "Scheduled") \
        .lt("game_datetime", today_start) \
        .order("game_datetime") \
        .execute()

    return result.data


def fix_orphaned_games(client, progress: BackfillProgress, orphaned_games: List[Dict]):
    """
    Fix orphaned games by re-syncing them from NBA API.
    This will update their status to 'Final' and fetch scores/player stats.
    """
    if not orphaned_games:
        return

    print(f"\n[Step 0] Fixing {len(orphaned_games)} orphaned games (Scheduled but past date)...")
    print("         These games should have status='Final'. Re-syncing from NBA API...")

    # Group by date for efficient syncing (extract date from game_datetime)
    dates_to_sync = sorted(set(
        g['game_datetime'][:10] for g in orphaned_games if g.get('game_datetime')
    ))
    
    progress.start_time = time.time()
    
    for i, date_str in enumerate(dates_to_sync):
        try:
            elapsed = time.time() - progress.start_time
            rate = (i + 1) / elapsed if elapsed > 0 else 0
            remaining = len(dates_to_sync) - i - 1
            eta = remaining / rate if rate > 0 else 0
            
            print_progress(i + 1, len(dates_to_sync), "Fix Orphaned: ", eta)
            
            # Re-sync this date to get correct status and scores
            sync_games_for_date(date_str, sync_player_stats=True)
            
            # Rate limiting with jitter
            rate_limit_sleep(DELAY_BETWEEN_DATES_MIN, DELAY_BETWEEN_DATES_MAX, f"fix date {date_str}")
            
        except KeyboardInterrupt:
            print("\n\n[Interrupted] Progress saved.")
            progress.save()
            sys.exit(0)
        except Exception as e:
            print(f"\n[Error] Failed to fix games for date {date_str}: {e}")
            continue
    
    print()  # New line after progress bar
    print(f"  Fixed orphaned games for {len(dates_to_sync)} dates")


def run_check_mode(client, progress: BackfillProgress):
    """Dry run - show what needs to be synced."""
    print_header("BACKFILL CHECK (Dry Run)")

    # Check orphaned games (CRITICAL: past games with status != Final)
    orphaned_games = get_orphaned_scheduled_games(client)
    if orphaned_games:
        print(f"\n⚠️  CRITICAL: {len(orphaned_games)} orphaned games found!")
        print(f"   These games have status='Scheduled' but game_datetime is in the past.")
        print(f"   All past games should have status='Final'.")
        print(f"\n   Sample orphaned games:")
        for g in orphaned_games[:5]:
            game_date = g['game_datetime'][:10] if g.get('game_datetime') else 'N/A'
            print(f"     {g['id']} | {game_date} | status={g['status']}")
        if len(orphaned_games) > 5:
            print(f"     ... and {len(orphaned_games) - 5} more")
        print(f"\n   → Run --phase1 or --all to fix these games")
    else:
        print(f"\n✓ No orphaned games (all past games have correct status)")

    # Check dates
    dates_needed = get_dates_needing_sync(client, progress)
    print(f"\nDates needing game sync: {len(dates_needed)}")
    if dates_needed:
        print(f"  First: {dates_needed[0]}")
        print(f"  Last:  {dates_needed[-1]}")

    # Check game stats
    games_needing_stats = get_games_needing_stats(client, progress)
    print(f"\nGames needing player stats: {len(games_needing_stats)}")
    if games_needing_stats:
        print(f"  Sample: {[g['id'] for g in games_needing_stats[:5]]}")

    # Check advanced stats
    games_needing_advanced = get_games_needing_advanced_stats(client, progress)
    print(f"\nGames needing advanced stats: {len(games_needing_advanced)}")
    if games_needing_advanced:
        print(f"  Sample: {[g['id'] for g in games_needing_advanced[:5]]}")

    # Check season stats freshness
    result = client.table("player_season_stats").select("updated_at").limit(1).execute()
    if result.data:
        last_update = result.data[0].get('updated_at', 'N/A')[:10]
        print(f"\nPlayer season stats last updated: {last_update}")

    result = client.table("team_standings").select("updated_at").limit(1).execute()
    if result.data:
        last_update = result.data[0].get('updated_at', 'N/A')[:10]
        print(f"Team standings last updated: {last_update}")

    # Estimate time (include orphaned games fix)
    orphaned_dates = len(set(
        g['game_datetime'][:10] for g in orphaned_games if g.get('game_datetime')
    )) if orphaned_games else 0
    total_dates = len(dates_needed) + orphaned_dates
    est_time = (total_dates * DELAY_BETWEEN_DATES +
                len(games_needing_stats) * DELAY_BETWEEN_GAMES +
                len(games_needing_advanced) * DELAY_BETWEEN_GAMES)

    print(f"\n{'='*70}")
    print(f"ESTIMATED BACKFILL TIME: {est_time/60:.1f} minutes ({est_time/3600:.1f} hours)")
    print(f"{'='*70}")


def run_phase1(client, progress: BackfillProgress):
    """Phase 1: Sync games and player stats by date."""
    print_header("PHASE 1: Sync Games + Player Stats")

    if progress.phase1_complete:
        print("Phase 1 already complete (from checkpoint). Skipping...")
        return

    # Step 0: Fix orphaned games FIRST (past games with wrong status)
    orphaned_games = get_orphaned_scheduled_games(client)
    if orphaned_games:
        print(f"\n⚠️  Found {len(orphaned_games)} orphaned games (Scheduled but past date)")
        fix_orphaned_games(client, progress, orphaned_games)

    # Step 1a: Sync game dates (scores + basic info)
    dates_needed = get_dates_needing_sync(client, progress)

    if dates_needed:
        print(f"\n[Step 1a] Syncing {len(dates_needed)} dates...")
        progress.start_time = time.time()

        for i, date_str in enumerate(dates_needed):
            try:
                elapsed = time.time() - progress.start_time
                rate = (i + 1) / elapsed if elapsed > 0 else 0
                remaining = len(dates_needed) - i - 1
                eta = remaining / rate if rate > 0 else 0

                print_progress(i + 1, len(dates_needed), "Dates: ", eta)

                # Sync games for this date (with player stats for Final games)
                sync_games_for_date(date_str, sync_player_stats=True)
                progress.mark_date_complete(date_str)

                # Rate limiting with jitter
                rate_limit_sleep(DELAY_BETWEEN_DATES_MIN, DELAY_BETWEEN_DATES_MAX, f"date {date_str}")

            except KeyboardInterrupt:
                print("\n\n[Interrupted] Progress saved. Run with --resume to continue.")
                progress.save()
                sys.exit(0)
            except Exception as e:
                print(f"\n[Error] Failed to sync date {date_str}: {e}")
                # Continue with next date
                continue

        print()  # New line after progress bar
    else:
        print("[Step 1a] All dates already synced!")

    # Step 1b: Sync advanced stats for games that need it
    games_needing_advanced = get_games_needing_advanced_stats(client, progress)

    if games_needing_advanced:
        print(f"\n[Step 1b] Syncing advanced stats for {len(games_needing_advanced)} games...")
        progress.start_time = time.time()

        for i, game in enumerate(games_needing_advanced):
            try:
                elapsed = time.time() - progress.start_time
                rate = (i + 1) / elapsed if elapsed > 0 else 0
                remaining = len(games_needing_advanced) - i - 1
                eta = remaining / rate if rate > 0 else 0

                print_progress(i + 1, len(games_needing_advanced), "Adv Stats: ", eta)

                sync_game_player_advanced_stats(game['id'])
                progress.mark_advanced_stats_complete(game['id'])

                # Rate limiting with jitter
                rate_limit_sleep(DELAY_BETWEEN_GAMES_MIN, DELAY_BETWEEN_GAMES_MAX, f"game {game['id']}")

            except KeyboardInterrupt:
                print("\n\n[Interrupted] Progress saved. Run with --resume to continue.")
                progress.save()
                sys.exit(0)
            except Exception as e:
                print(f"\n[Error] Failed to sync advanced stats for {game['id']}: {e}")
                continue

        print()  # New line after progress bar
    else:
        print("[Step 1b] All advanced stats already synced!")

    progress.phase1_complete = True
    progress.save()
    print("\n Phase 1 complete!")


def run_phase2(client, progress: BackfillProgress):
    """Phase 2: Sync season aggregate stats."""
    print_header("PHASE 2: Sync Season Aggregates")

    if progress.phase2_complete:
        print("Phase 2 already complete (from checkpoint). Skipping...")
        return

    try:
        # Player season stats
        print("\n[Step 2a] Syncing player season stats...")
        sync_player_season_stats()
        print("  Player season stats synced")
        time.sleep(DELAY_BETWEEN_PHASES)

        # Player season advanced stats
        print("\n[Step 2b] Syncing player season advanced stats...")
        sync_player_season_advanced_stats()
        print("  Player season advanced stats synced")
        time.sleep(DELAY_BETWEEN_PHASES)

        # Team standings
        print("\n[Step 2c] Syncing team standings...")
        sync_team_standings()
        print("  Team standings synced")
        time.sleep(DELAY_BETWEEN_PHASES)

        # Team season advanced stats
        print("\n[Step 2d] Syncing team season advanced stats...")
        sync_team_season_advanced_stats()
        print("  Team season advanced stats synced")

        progress.phase2_complete = True
        progress.save()
        print("\n Phase 2 complete!")

    except KeyboardInterrupt:
        print("\n\n[Interrupted] Progress saved.")
        progress.save()
        sys.exit(0)
    except Exception as e:
        print(f"\n[Error] Phase 2 failed: {e}")
        raise


def run_all(client, progress: BackfillProgress):
    """Run all phases."""
    print_header("FULL BACKFILL - ALL PHASES")

    start_time = time.time()

    run_phase1(client, progress)
    time.sleep(DELAY_BETWEEN_PHASES)
    run_phase2(client, progress)

    elapsed = time.time() - start_time
    print(f"\n{'='*70}")
    print(f" BACKFILL COMPLETE!")
    print(f"   Total time: {elapsed/60:.1f} minutes")
    print(f"{'='*70}")

    # Clean up checkpoint file
    if os.path.exists(CHECKPOINT_FILE):
        os.remove(CHECKPOINT_FILE)
        print("\n[Checkpoint] Removed checkpoint file (backfill complete)")


def main():
    parser = argparse.ArgumentParser(
        description='NBA Data Backfill Script',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python check-data/backfill_data.py --check     # Show what needs sync
  python check-data/backfill_data.py --phase1    # Sync games + player stats
  python check-data/backfill_data.py --phase2    # Sync season aggregates only
  python check-data/backfill_data.py --all       # Run full backfill
  python check-data/backfill_data.py --resume    # Resume from checkpoint
  python check-data/backfill_data.py --clear     # Clear checkpoint
        """
    )

    parser.add_argument('--check', action='store_true', help='Dry run - show what needs sync')
    parser.add_argument('--phase1', action='store_true', help='Run Phase 1: Games + Player Stats')
    parser.add_argument('--phase2', action='store_true', help='Run Phase 2: Season Aggregates')
    parser.add_argument('--all', action='store_true', help='Run all phases')
    parser.add_argument('--resume', action='store_true', help='Resume from checkpoint')
    parser.add_argument('--clear', action='store_true', help='Clear checkpoint file')

    args = parser.parse_args()

    # Handle --clear
    if args.clear:
        if os.path.exists(CHECKPOINT_FILE):
            os.remove(CHECKPOINT_FILE)
            print("Checkpoint file cleared.")
        else:
            print("No checkpoint file to clear.")
        return

    # Default to --check if no args
    if not any([args.check, args.phase1, args.phase2, args.all, args.resume]):
        args.check = True

    now_tokyo = datetime.now(TOKYO_TZ)
    print()
    print("*" * 70)
    print("*" + " " * 68 + "*")
    print("*" + "           NBA DATA BACKFILL SCRIPT".center(68) + "*")
    print("*" + f"   Season: {SEASON}  |  {now_tokyo.strftime('%Y-%m-%d %H:%M JST')}".center(68) + "*")
    print("*" + " " * 68 + "*")
    print("*" * 70)

    # Initialize client and progress tracker
    client = create_client(SUPABASE_URL, SUPABASE_KEY)
    progress = BackfillProgress()

    try:
        if args.check:
            run_check_mode(client, progress)
        elif args.phase1:
            run_phase1(client, progress)
        elif args.phase2:
            run_phase2(client, progress)
        elif args.all or args.resume:
            run_all(client, progress)
    except KeyboardInterrupt:
        print("\n\n[Interrupted] Progress saved to checkpoint.")
        progress.save()
        sys.exit(0)
    except Exception as e:
        print(f"\n[Fatal Error] {e}")
        progress.save()
        raise


if __name__ == "__main__":
    main()
