"""
Background worker for processing NBA data sync tasks from task_queue.

Supports:
- Automatic polling from task_queue table (n8n workflow integration)
- Manual CLI execution for error correction

Task Types (from n8n workflow):
- SYNC_LIVE_GAME: Sync specific game by game_id (n8n) or game_ids (manual batch)
- DAILY_WRAP_UP: End-of-day aggregate updates (standings, player stats)
- FIRST_GAME_NOTIFIED: Marker task for first game notification tracking

Task Types (manual execution):
- SYNC_DATE_GAMES: Sync all games for a specific date
- SYNC_PLAYER_STATS: Sync player statistics
- SYNC_ADVANCED_STATS: Sync advanced statistics
- DATA_AUDIT: Run data consistency check
- BACKFILL_DATA: Repair missing data

Usage:
    # Run as background worker (polls task_queue)
    python worker.py
    
    # Run specific task manually (for error correction)
    python worker.py --task SYNC_LIVE_GAME --payload '{"game_id": "0022500001"}'
    python worker.py --task SYNC_DATE_GAMES --payload '{"date": "2025-01-20"}'
    python worker.py --task DATA_AUDIT
"""
import os
import sys
import time
import json
import argparse
import traceback
from datetime import datetime
from typing import Optional, Dict, Any

import pytz

# Load environment variables first (before importing other modules)
from dotenv import load_dotenv

# Determine which env file to use
ENV = os.getenv("ENVIRONMENT", "development").lower()
if ENV == "production":
    env_file = ".env.production"
elif ENV in ("development", "dev"):
    env_file = ".env.development"
else:
    env_file = ".env"

if os.path.exists(env_file):
    load_dotenv(env_file)
    print(f"[worker] Loaded environment from {env_file}")
elif os.path.exists(".env"):
    load_dotenv(".env")
    print("[worker] Loaded environment from .env")
else:
    print("[worker] No .env file found, using system environment variables")

# Now import application modules
from db import get_db
from utils import SyncLogger, TOKYO_TZ


# ============================================================================
# TASK HANDLERS
# ============================================================================

def handle_sync_live_game(payload: Dict[str, Any], logger: SyncLogger) -> bool:
    """
    Handle SYNC_LIVE_GAME task.
    Syncs game data for the specified game IDs.
    
    Payload (supports both formats):
        game_id: Single game ID (from n8n workflow)
        game_ids: List of game IDs (for manual/batch execution)
    """
    # Support both single game_id (from n8n) and game_ids array (for batch)
    game_ids = payload.get("game_ids", [])
    if not game_ids:
        # Check for single game_id from n8n workflow
        single_game_id = payload.get("game_id")
        if single_game_id:
            game_ids = [single_game_id]
    
    if not game_ids:
        logger.warning("SYNC_LIVE_GAME task has no game_id(s) in payload")
        return True  # Nothing to do, mark as success

    logger.info(f"Processing SYNC_LIVE_GAME for {len(game_ids)} games: {game_ids}")

    from services.game_service import sync_single_game

    success_count = 0
    for game_id in game_ids:
        try:
            logger.info(f"Syncing game {game_id}...")
            sync_single_game(str(game_id))
            success_count += 1
            logger.info(f"Successfully synced game {game_id}")
        except Exception as e:
            logger.error(f"Failed to sync game {game_id}: {str(e)}")

    logger.info(f"SYNC_LIVE_GAME completed: {success_count}/{len(game_ids)} games synced")
    return success_count > 0


def handle_sync_date_games(payload: Dict[str, Any], logger: SyncLogger) -> bool:
    """
    Handle SYNC_DATE_GAMES task.
    Syncs all games for a specific date with player stats.
    
    Payload:
        date: Date string in YYYY-MM-DD format
        with_stats: Whether to sync player stats (default: True)
    """
    date_str = payload.get("date")
    if not date_str:
        # Default to yesterday (US Eastern) if no date specified
        us_eastern = pytz.timezone('US/Eastern')
        yesterday = datetime.now(us_eastern).date()
        date_str = yesterday.strftime("%Y-%m-%d")
    
    with_stats = payload.get("with_stats", True)
    
    logger.info(f"Processing SYNC_DATE_GAMES for date: {date_str} (with_stats={with_stats})")

    from services.game_service import sync_games_for_date

    try:
        sync_games_for_date(date_str, sync_player_stats=with_stats)
        logger.info(f"SYNC_DATE_GAMES completed for {date_str}")
        return True
    except Exception as e:
        logger.error(f"SYNC_DATE_GAMES failed for {date_str}: {str(e)}")
        return False


def handle_daily_wrap_up(payload: Dict[str, Any], logger: SyncLogger) -> bool:
    """
    Handle DAILY_WRAP_UP task.
    Performs end-of-day aggregate data sync.
    
    Payload:
        sync_standings: Sync team standings (default: True)
        sync_player_stats: Sync player season stats (default: True)
        sync_advanced: Sync advanced stats (default: False)
    """
    sync_standings = payload.get("sync_standings", True)
    sync_player_stats = payload.get("sync_player_stats", True)
    sync_advanced = payload.get("sync_advanced", False)
    
    logger.info("Processing DAILY_WRAP_UP...")

    from services import (
        sync_team_standings,
        sync_player_season_stats,
        sync_player_season_advanced_stats,
        sync_team_season_advanced_stats,
    )

    try:
        if sync_standings:
            logger.info("Syncing team standings...")
            sync_team_standings()

        if sync_player_stats:
            logger.info("Syncing player season stats...")
            sync_player_season_stats()

        if sync_advanced:
            logger.info("Syncing player advanced stats...")
            sync_player_season_advanced_stats()
            logger.info("Syncing team advanced stats...")
            sync_team_season_advanced_stats()

        logger.info("DAILY_WRAP_UP completed successfully")
        return True
    except Exception as e:
        logger.error(f"DAILY_WRAP_UP failed: {str(e)}")
        return False


def handle_sync_player_stats(payload: Dict[str, Any], logger: SyncLogger) -> bool:
    """
    Handle SYNC_PLAYER_STATS task.
    Syncs player statistics (season stats).
    
    Payload:
        (no required params - syncs all active players)
    """
    logger.info("Processing SYNC_PLAYER_STATS...")

    from services import sync_player_season_stats

    try:
        sync_player_season_stats()
        logger.info("SYNC_PLAYER_STATS completed successfully")
        return True
    except Exception as e:
        logger.error(f"SYNC_PLAYER_STATS failed: {str(e)}")
        return False


def handle_sync_advanced_stats(payload: Dict[str, Any], logger: SyncLogger) -> bool:
    """
    Handle SYNC_ADVANCED_STATS task.
    Syncs advanced statistics for players and teams.
    
    Payload:
        players: Sync player advanced stats (default: True)
        teams: Sync team advanced stats (default: True)
    """
    sync_players = payload.get("players", True)
    sync_teams = payload.get("teams", True)
    
    logger.info("Processing SYNC_ADVANCED_STATS...")

    from services import (
        sync_player_season_advanced_stats,
        sync_team_season_advanced_stats,
    )

    try:
        if sync_players:
            logger.info("Syncing player advanced stats...")
            sync_player_season_advanced_stats()

        if sync_teams:
            logger.info("Syncing team advanced stats...")
            sync_team_season_advanced_stats()

        logger.info("SYNC_ADVANCED_STATS completed successfully")
        return True
    except Exception as e:
        logger.error(f"SYNC_ADVANCED_STATS failed: {str(e)}")
        return False


def handle_data_audit(payload: Dict[str, Any], logger: SyncLogger) -> bool:
    """
    Handle DATA_AUDIT task.
    Runs data consistency check and reports issues.
    
    Payload:
        auto_fix: If True, attempt to fix orphaned games (default: False)
    """
    auto_fix = payload.get("auto_fix", False)
    
    logger.info(f"Processing DATA_AUDIT (auto_fix={auto_fix})...")

    db = get_db()
    season = "2025-26"
    today_str = datetime.now(TOKYO_TZ).strftime("%Y-%m-%d")
    issues_found = []

    try:
        # Check 1: Orphaned games (Scheduled but past datetime)
        # Use Tokyo timezone boundary for today
        today_start = f"{today_str}T00:00:00+09:00"  # Tokyo timezone
        result = db.table("games") \
            .select("id, game_datetime, status") \
            .eq("season", season) \
            .eq("status", "Scheduled") \
            .lt("game_datetime", today_start) \
            .execute()

        orphaned_games = result.data
        if orphaned_games:
            issues_found.append({
                "type": "orphaned_scheduled_games",
                "count": len(orphaned_games),
                "sample": [g['id'] for g in orphaned_games[:5]]
            })
            logger.warning(f"Found {len(orphaned_games)} orphaned games (Scheduled but past date)")

        # Check 2: Final games without scores
        result = db.table("games") \
            .select("id, game_datetime") \
            .eq("season", season) \
            .eq("status", "Final") \
            .is_("home_score", "null") \
            .execute()
        
        games_no_scores = result.data
        if games_no_scores:
            issues_found.append({
                "type": "final_games_no_scores",
                "count": len(games_no_scores),
                "sample": [g['id'] for g in games_no_scores[:5]]
            })
            logger.warning(f"Found {len(games_no_scores)} Final games without scores")

        # Check 3: Final games without player stats
        final_result = db.table("games") \
            .select("id") \
            .eq("season", season) \
            .eq("status", "Final") \
            .execute()
        final_game_ids = set(g['id'] for g in final_result.data)

        stats_result = db.table("game_player_stats").select("game_id").execute()
        stats_game_ids = set(r['game_id'] for r in stats_result.data)

        games_missing_stats = final_game_ids - stats_game_ids
        if games_missing_stats:
            issues_found.append({
                "type": "final_games_no_player_stats",
                "count": len(games_missing_stats),
                "sample": list(games_missing_stats)[:5]
            })
            logger.warning(f"Found {len(games_missing_stats)} Final games without player stats")

        # Auto-fix if requested
        if auto_fix and orphaned_games:
            logger.info("Attempting to fix orphaned games...")
            from services.game_service import sync_games_for_date

            # Extract dates from game_datetime (TIMESTAMPTZ)
            dates_to_fix = sorted(set(
                g['game_datetime'][:10] for g in orphaned_games if g.get('game_datetime')
            ))
            fixed_count = 0
            for date_str in dates_to_fix[:10]:  # Limit to 10 dates
                try:
                    sync_games_for_date(date_str, sync_player_stats=True)
                    fixed_count += 1
                    time.sleep(3)  # Rate limiting
                except Exception as e:
                    logger.error(f"Failed to fix games for {date_str}: {e}")

            logger.info(f"Fixed games for {fixed_count}/{len(dates_to_fix)} dates")

        # Summary
        if issues_found:
            logger.warning(f"DATA_AUDIT found {len(issues_found)} issue types", issues=issues_found)
        else:
            logger.success("DATA_AUDIT passed - no issues found")

        return True
    except Exception as e:
        logger.error(f"DATA_AUDIT failed: {str(e)}")
        return False


def handle_backfill_data(payload: Dict[str, Any], logger: SyncLogger) -> bool:
    """
    Handle BACKFILL_DATA task.
    Repairs missing data for a date range.
    
    Payload:
        start_date: Start date (YYYY-MM-DD)
        end_date: End date (YYYY-MM-DD)
        with_stats: Sync player stats (default: True)
    """
    start_date = payload.get("start_date")
    end_date = payload.get("end_date")
    with_stats = payload.get("with_stats", True)
    
    if not start_date or not end_date:
        logger.error("BACKFILL_DATA requires start_date and end_date")
        return False

    logger.info(f"Processing BACKFILL_DATA: {start_date} to {end_date}")

    from datetime import timedelta
    from services.game_service import sync_games_for_date

    try:
        current = datetime.strptime(start_date, "%Y-%m-%d")
        end = datetime.strptime(end_date, "%Y-%m-%d")
        
        dates_synced = 0
        while current <= end:
            date_str = current.strftime("%Y-%m-%d")
            try:
                logger.info(f"Backfilling {date_str}...")
                sync_games_for_date(date_str, sync_player_stats=with_stats)
                dates_synced += 1
                time.sleep(5)  # Conservative rate limiting
            except Exception as e:
                logger.error(f"Failed to backfill {date_str}: {e}")
            
            current += timedelta(days=1)

        logger.info(f"BACKFILL_DATA completed: {dates_synced} dates processed")
        return True
    except Exception as e:
        logger.error(f"BACKFILL_DATA failed: {str(e)}")
        return False



def handle_check_schedule(payload: Dict[str, Any], logger: SyncLogger) -> bool:
    """
    Handle CHECK_SCHEDULE task (Heartbeat from n8n).

    Logic:
    1. Check DB for active games (Live) or games starting soon.
    2. If found, trigger sync for those games.
    3. Detect status changes and queue notifications.
    """
    logger.info("Processing CHECK_SCHEDULE...")

    db = get_db()
    current_time = datetime.now(pytz.UTC)

    # 1. Find relevant games
    # - Status is 'Live'
    # - OR Status is 'Scheduled' and game_datetime is within next 30 minutes (or past due)

    # Fetch today's games using Tokyo timezone date range
    today_str = datetime.now(TOKYO_TZ).strftime("%Y-%m-%d")
    today_start = f"{today_str}T00:00:00+09:00"  # Tokyo timezone start
    today_end = f"{today_str}T23:59:59+09:00"  # Tokyo timezone end

    # Fetch games for today
    result = db.table("games") \
        .select("id, status, game_datetime, is_time_tbd, home_team_id, away_team_id") \
        .gte("game_datetime", today_start) \
        .lte("game_datetime", today_end) \
        .execute()

    games = result.data
    games_to_sync = []

    for game in games:
        g_status = game.get('status')
        g_datetime_str = game.get('game_datetime')
        g_id = game.get('id')
        is_tbd = game.get('is_time_tbd', False)

        if g_status == 'Live':
            games_to_sync.append(g_id)
            continue

        # Skip TBD games for auto-sync (they can't be "starting soon")
        if is_tbd:
            continue

        if g_status == 'Scheduled' and g_datetime_str:
            try:
                g_datetime = datetime.fromisoformat(g_datetime_str.replace('Z', '+00:00'))
                # If game is within 30 mins or has passed
                diff = (g_datetime - current_time).total_seconds() / 60
                if diff <= 30:  # Starts within 30 mins or already started
                    games_to_sync.append(g_id)
            except Exception:
                pass

    if not games_to_sync:
        logger.info("CHECK_SCHEDULE: No active/upcoming games found. Sleeping.")
        return True

    logger.info(f"CHECK_SCHEDULE: Found {len(games_to_sync)} active/upcoming games: {games_to_sync}")
    
    from services.game_service import sync_single_game
    
    notifications = []
    
    for game_id in games_to_sync:
        try:
            logger.info(f"Smart Syncing game {game_id}...")
            # sync_single_game returns comparison dict
            result = sync_single_game(game_id)
            
            if result:
                old = result.get('old_status')
                new = result.get('new_status')
                
                # Check for status changes
                if old != new:
                    logger.info(f"ℹ️ Status change detected for {game_id}: {old} -> {new}")
                    
                    # Detect Game Start
                    if old == 'Scheduled' and new == 'Live':
                        notifications.append({
                            "type": "GAME_START",
                            "payload": result
                        })
                    
                    # Detect Game End
                    elif (old == 'Live' or old == 'Scheduled') and new == 'Final':
                        notifications.append({
                            "type": "GAME_END",
                            "payload": result
                        })
                        
        except Exception as e:
            logger.error(f"Failed to sync game {game_id} in check_schedule: {e}")

    # Insert notifications
    if notifications:
        logger.info(f"Queueing {len(notifications)} notifications...")
        for n in notifications:
            try:
                db.table("notifications").insert({
                    "type": n["type"],
                    "payload": n["payload"],
                    "status": "PENDING"
                }).execute()
            except Exception as e:
                logger.error(f"Failed to insert notification: {e}")

    logger.info("CHECK_SCHEDULE completed")
    return True


def handle_first_game_notified(payload: Dict[str, Any], logger: SyncLogger) -> bool:
    """
    Handle FIRST_GAME_NOTIFIED task.
    This is a marker task inserted by n8n to track that first game notification was sent.
    The task is usually already marked COMPLETED by n8n, so this handler is just a fallback.
    
    Payload:
        date: The date string (YYYY-MM-DD)
    """
    date_str = payload.get("date", "unknown")
    logger.info(f"FIRST_GAME_NOTIFIED marker for {date_str} acknowledged")
    return True


# Task type to handler mapping
TASK_HANDLERS = {
    "SYNC_LIVE_GAME": handle_sync_live_game,
    "SYNC_DATE_GAMES": handle_sync_date_games,
    "DAILY_WRAP_UP": handle_daily_wrap_up,
    "SYNC_PLAYER_STATS": handle_sync_player_stats,
    "SYNC_ADVANCED_STATS": handle_sync_advanced_stats,
    "DATA_AUDIT": handle_data_audit,
    "BACKFILL_DATA": handle_backfill_data,
    "FIRST_GAME_NOTIFIED": handle_first_game_notified,
    "CHECK_SCHEDULE": handle_check_schedule,
}


def fetch_pending_task(db) -> Optional[Dict[str, Any]]:
    """
    Fetch and claim a pending task from the queue.
    Uses SELECT ... FOR UPDATE pattern to prevent race conditions.
    """
    try:
        # Fetch oldest pending task
        result = db.table("task_queue") \
            .select("*") \
            .eq("status", "PENDING") \
            .order("created_at", desc=False) \
            .limit(1) \
            .execute()

        if not result.data:
            return None

        task = result.data[0]

        # Claim the task by updating status to PROCESSING
        db.table("task_queue") \
            .update({
                "status": "PROCESSING",
                "updated_at": datetime.utcnow().isoformat(),
                "started_at": datetime.utcnow().isoformat()
            }) \
            .eq("id", task["id"]) \
            .eq("status", "PENDING") \
            .execute()

        return task
    except Exception as e:
        print(f"[worker] Error fetching task: {e}")
        return None


def update_task_status(db, task_id: int, status: str, error: Optional[str] = None) -> None:
    """Update task status after processing."""
    try:
        update_data = {
            "status": status,
            "updated_at": datetime.utcnow().isoformat(),
            "completed_at": datetime.utcnow().isoformat()
        }
        if error:
            # Store error in payload if there's an error
            update_data["error_log"] = error[:1000]  # Truncate if too long

        db.table("task_queue") \
            .update(update_data) \
            .eq("id", task_id) \
            .execute()
    except Exception as e:
        print(f"[worker] Error updating task {task_id}: {e}")


def process_task(task: Dict[str, Any], logger: SyncLogger) -> bool:
    """Process a single task."""
    task_type = task.get("task_type")
    payload = task.get("payload", {})

    # Handle payload if it's a string
    if isinstance(payload, str):
        try:
            payload = json.loads(payload)
        except json.JSONDecodeError:
            payload = {}

    logger.set_command(f"worker:{task_type}")
    logger.info(f"Processing task: {task_type} (id={task.get('id')})")

    handler = TASK_HANDLERS.get(task_type)
    if not handler:
        logger.error(f"Unknown task type: {task_type}")
        return False

    try:
        return handler(payload, logger)
    except Exception as e:
        logger.error(f"Task handler failed: {str(e)}")
        traceback.print_exc()
        return False


def run_worker(poll_interval: int = 10) -> None:
    """
    Main worker loop.
    Polls task_queue every poll_interval seconds.
    """
    now = datetime.now(TOKYO_TZ)
    print("=" * 60)
    print("NBA Data Sync Worker")
    print("=" * 60)
    print(f"Environment: {ENV}")
    print(f"Start time: {now.strftime('%Y-%m-%d %H:%M:%S JST')}")
    print(f"Poll interval: {poll_interval} seconds")
    print(f"Registered task handlers: {list(TASK_HANDLERS.keys())}")
    print("=" * 60)
    print()

    # Initialize database connection
    try:
        db = get_db()
        print("[worker] Database connection established")
    except Exception as e:
        print(f"[worker] Failed to connect to database: {e}")
        sys.exit(1)

    # Initialize logger
    logger = SyncLogger(json_mode=False)

    print("[worker] Starting task polling loop...")
    print()

    consecutive_errors = 0
    max_consecutive_errors = 5

    while True:
        try:
            # Fetch a pending task
            task = fetch_pending_task(db)

            if task:
                task_id = task.get("id")
                task_type = task.get("task_type")

                print(f"[worker] Found task: {task_type} (id={task_id})")

                # Process the task
                success = process_task(task, logger)

                # Update task status
                if success:
                    update_task_status(db, task_id, "COMPLETED")
                    print(f"[worker] Task {task_id} completed successfully")
                else:
                    update_task_status(db, task_id, "FAILED", "Task handler returned failure")
                    print(f"[worker] Task {task_id} failed")

                # Reset error counter on successful processing
                consecutive_errors = 0

                # Small delay between tasks to avoid hammering the API
                time.sleep(2)
            else:
                # No task found, wait before polling again
                consecutive_errors = 0  # Reset on successful poll
                time.sleep(poll_interval)

        except KeyboardInterrupt:
            print("\n[worker] Received shutdown signal")
            break
        except Exception as e:
            consecutive_errors += 1
            print(f"[worker] Error in main loop: {e}")
            traceback.print_exc()

            if consecutive_errors >= max_consecutive_errors:
                print(f"[worker] Too many consecutive errors ({consecutive_errors}), exiting...")
                sys.exit(1)

            # Exponential backoff on errors
            sleep_time = min(poll_interval * (2 ** consecutive_errors), 300)
            print(f"[worker] Sleeping for {sleep_time} seconds before retry...")
            time.sleep(sleep_time)

    print("[worker] Worker stopped")


def run_manual_task(task_type: str, payload: Dict[str, Any]) -> bool:
    """
    Run a single task manually (for error correction).
    
    Args:
        task_type: Task type (e.g., "SYNC_LIVE_GAME")
        payload: Task payload dictionary
    
    Returns:
        True if task succeeded, False otherwise
    """
    now = datetime.now(TOKYO_TZ)
    print("=" * 60)
    print("NBA Data Sync - Manual Task Execution")
    print("=" * 60)
    print(f"Time: {now.strftime('%Y-%m-%d %H:%M:%S JST')}")
    print(f"Task: {task_type}")
    print(f"Payload: {json.dumps(payload, indent=2)}")
    print("=" * 60)
    print()

    logger = SyncLogger(json_mode=False)

    task = {
        "id": "manual",
        "task_type": task_type,
        "payload": payload
    }

    success = process_task(task, logger)

    print()
    print("=" * 60)
    if success:
        print("✅ Task completed successfully")
    else:
        print("❌ Task failed")
    print("=" * 60)

    return success


def parse_args():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        description="NBA Data Sync Worker",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Task Types (n8n workflow):
  SYNC_LIVE_GAME        Sync specific game(s)
  DAILY_WRAP_UP         End-of-day aggregate sync
  FIRST_GAME_NOTIFIED   Marker task (notification tracking)

Task Types (manual):
  SYNC_DATE_GAMES       Sync all games for a date
  SYNC_PLAYER_STATS     Sync player season stats
  SYNC_ADVANCED_STATS   Sync advanced stats
  DATA_AUDIT            Check data consistency
  BACKFILL_DATA         Repair missing data

Examples:
  # Run as background worker (default)
  python worker.py
  
  # Manual task execution
  python worker.py --task SYNC_LIVE_GAME --payload '{"game_id": "0022500001"}'
  python worker.py --task SYNC_DATE_GAMES --payload '{"date": "2025-01-20"}'
  python worker.py --task DATA_AUDIT
  python worker.py --task BACKFILL_DATA --payload '{"start_date": "2025-01-01", "end_date": "2025-01-10"}'
        """
    )

    parser.add_argument(
        "--task", "-t",
        type=str,
        choices=list(TASK_HANDLERS.keys()),
        help="Task type to run manually (skips queue polling)"
    )
    parser.add_argument(
        "--payload", "-p",
        type=str,
        default="{}",
        help="JSON payload for the task (default: {})"
    )
    parser.add_argument(
        "--poll-interval",
        type=int,
        default=int(os.getenv("WORKER_POLL_INTERVAL", "10")),
        help="Poll interval in seconds (default: 10)"
    )

    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()

    if args.task:
        # Manual task execution mode
        try:
            payload = json.loads(args.payload)
        except json.JSONDecodeError as e:
            print(f"Error parsing payload JSON: {e}")
            sys.exit(1)

        success = run_manual_task(args.task, payload)
        sys.exit(0 if success else 1)
    else:
        # Background worker mode
        run_worker(poll_interval=args.poll_interval)
