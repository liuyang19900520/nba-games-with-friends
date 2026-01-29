"""
Game schedule synchronization service.
Fetches NBA game schedule information (pre-game data: datetime, arena, status)
and syncs to Supabase games table.

This service is separate from game stats synchronization:
- sync_schedule: Maintains games table with schedule information (pre-game data)
- sync_stats: Maintains game_player_stats table with post-game statistics

Key data model (2026-01):
- game_datetime: TIMESTAMPTZ - Combined date+time in UTC
- is_time_tbd: BOOLEAN - True when game time is not yet announced

API: ScoreboardV2 (to get game IDs) + BoxScoreSummaryV3 (to get detailed schedule info)
Table: games
Unique constraint: id
"""
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
import pytz

from nba_api.stats.endpoints import scoreboardv2, boxscoresummaryv3
from db import get_db
from utils import get_current_nba_season, safe_call_nba_api


def _build_team_map() -> Tuple[Dict[str, str], Dict[str, int]]:
    """
    Build mapping dictionaries for team lookups.
    
    Returns:
        Tuple of:
        - Dict mapping tricode (e.g., 'LAL') to database team ID (e.g., 1610612747)
        - Dict mapping NBA team ID (e.g., 1610612747) to database team ID
    """
    supabase = get_db()
    print("Fetching teams from Supabase to build team mapping...")
    
    teams_result = supabase.table('teams').select('id, code').execute()
    
    if not teams_result.data:
        print("⚠️ Warning: No teams found in database. Please sync teams first.")
        return {}, {}
    
    # Map: tricode -> database team_id
    tricode_to_id: Dict[str, str] = {}
    # Map: NBA team_id -> database team_id (for lookup by NBA team_id)
    nba_team_id_to_db_id: Dict[str, int] = {}
    
    for team in teams_result.data:
        code = team.get('code', '').strip().upper()
        team_id = team.get('id')
        if code and team_id:
            team_id_str = str(team_id)
            tricode_to_id[code] = team_id_str
            nba_team_id_to_db_id[team_id_str] = int(team_id)
    
    print(f"✅ Built team map with {len(tricode_to_id)} teams")
    return tricode_to_id, nba_team_id_to_db_id


def _map_game_status(status_code: int) -> str:
    """
    Map NBA API status code to database status string.
    
    Args:
        status_code: NBA API status code (1=Scheduled, 2=Live, 3=Final)
    
    Returns:
        Status string: 'Scheduled', 'Live', or 'Final'
    """
    status_map = {
        1: 'Scheduled',
        2: 'Live',
        3: 'Final'
    }
    return status_map.get(status_code, 'Scheduled')


def _get_game_ids_for_date_range(start_date: datetime, end_date: datetime) -> List[str]:
    """
    Get all game IDs for a date range using ScoreboardV2.
    
    Args:
        start_date: Start date (timezone-aware)
        end_date: End date (timezone-aware)
    
    Returns:
        List of game IDs (strings)
    """
    game_ids: set = set()
    current_date = start_date
    
    while current_date <= end_date:
        date_str_v2 = current_date.strftime('%m/%d/%Y')
        
        scoreboard_obj = safe_call_nba_api(
            name=f"ScoreboardV2 for {current_date.strftime('%Y-%m-%d')}",
            call_fn=lambda: scoreboardv2.ScoreboardV2(game_date=date_str_v2),
            max_retries=3,
            base_delay=3.0,
            post_success_sleep=0.5,  # Rate limiting
        )
        
        if scoreboard_obj:
            data = scoreboard_obj.get_dict()
            result_sets = data.get('resultSets', [])
            
            if result_sets and len(result_sets) > 0:
                game_header = result_sets[0]
                game_rows = game_header.get('rowSet', [])
                headers = game_header.get('headers', [])
                
                game_id_idx = headers.index('GAME_ID') if 'GAME_ID' in headers else 0
                
                for row in game_rows:
                    if game_id_idx < len(row):
                        game_id = str(row[game_id_idx])
                        game_ids.add(game_id)
        
        # Move to next day
        current_date += timedelta(days=1)
    
    return sorted(list(game_ids))


def _fetch_game_schedule_info(game_id: str, nba_team_id_to_db_id: Dict[str, int]) -> Optional[Dict]:
    """
    Fetch detailed schedule information for a single game using BoxScoreSummaryV3.
    
    Args:
        game_id: NBA game ID (e.g., '0022500571')
        nba_team_id_to_db_id: Mapping from NBA team ID to database team ID
    
    Returns:
        Dict with schedule information, or None if fetch failed
    """
    boxscore = safe_call_nba_api(
        name=f"BoxScoreSummaryV3(game_id={game_id})",
        call_fn=lambda: boxscoresummaryv3.BoxScoreSummaryV3(game_id=game_id),
        max_retries=3,
        base_delay=2.0,
        post_success_sleep=0.3,  # Rate limiting
    )
    
    if boxscore is None:
        return None
    
    data = boxscore.get_dict()
    box_summary = data.get('boxScoreSummary', {})
    
    if not box_summary:
        return None
    
    # Extract schedule information
    game_time_et = box_summary.get('gameEt', '')  # Eastern Time (most accurate)
    game_time_utc = box_summary.get('gameTimeUTC', '')  # UTC time
    game_status_code = box_summary.get('gameStatus', 1)
    home_team_id_nba = box_summary.get('homeTeamId')
    away_team_id_nba = box_summary.get('awayTeamId')
    arena = box_summary.get('arena', {})
    arena_name = arena.get('arenaName', '') if isinstance(arena, dict) else ''
    
    # Use gameEt if available (more accurate), otherwise use gameTimeUTC
    game_time_str = game_time_et if game_time_et else game_time_utc
    
    if not game_time_str:
        return None
    
    # Parse and convert to UTC
    is_time_tbd = False
    try:
        # gameEt format: "2026-01-14T19:00:00Z" or "2026-01-14T19:00:00"
        dt_str = game_time_str.replace('Z', '')
        if 'T' in dt_str:
            # Parse as Eastern Time (gameEt is in ET)
            if game_time_et:
                dt = datetime.strptime(dt_str, '%Y-%m-%dT%H:%M:%S')
                est_tz = pytz.timezone('US/Eastern')
                dt = est_tz.localize(dt)
                # Check if time is midnight (indicates TBD)
                if dt.hour == 0 and dt.minute == 0 and dt.second == 0:
                    is_time_tbd = True
            else:
                # Parse as UTC (gameTimeUTC)
                dt = datetime.strptime(dt_str, '%Y-%m-%dT%H:%M:%S')
                dt = pytz.UTC.localize(dt)
                # Check if time is midnight (indicates TBD)
                if dt.hour == 0 and dt.minute == 0 and dt.second == 0:
                    is_time_tbd = True
        else:
            # Date only - means TBD
            dt = datetime.strptime(dt_str, '%Y-%m-%d')
            dt = dt.replace(hour=12, minute=0, second=0)
            est_tz = pytz.timezone('US/Eastern')
            dt = est_tz.localize(dt)
            is_time_tbd = True

        # Convert to UTC
        if dt.tzinfo is None:
            dt = pytz.UTC.localize(dt)
        else:
            dt = dt.astimezone(pytz.UTC)

        # Store as TIMESTAMPTZ (full datetime with timezone)
        game_datetime = dt
    except Exception as e:
        print(f"  ⚠️ Error parsing game time for {game_id}: {e}")
        return None
    
    # Map team IDs
    home_team_id = None
    away_team_id = None
    
    if home_team_id_nba:
        home_team_id = nba_team_id_to_db_id.get(str(home_team_id_nba))
    if away_team_id_nba:
        away_team_id = nba_team_id_to_db_id.get(str(away_team_id_nba))
    
    # Determine if game is playoff
    is_playoff = False
    if len(game_id) >= 2:
        game_type = game_id[:2]
        is_playoff = (game_type == '01')  # 01 = Playoffs
    
    # Map status
    status = _map_game_status(game_status_code)

    # Build schedule data (only pre-game information, no scores)
    # NOTE: During migration period, output BOTH old (game_date/game_time) and new (game_datetime/is_time_tbd)
    schedule_data = {
        'id': str(game_id),
        # New columns (TIMESTAMPTZ unified)
        'game_datetime': game_datetime.isoformat(),  # TIMESTAMPTZ (ISO format with timezone)
        'is_time_tbd': is_time_tbd,  # True if game time is not yet announced
        # Legacy columns (for backward compatibility during migration)
        'game_date': game_datetime.date().isoformat(),  # YYYY-MM-DD
        'game_time': game_datetime.time().isoformat(),  # HH:MM:SS
        'status': status,
        'is_playoff': is_playoff,
        'arena_name': arena_name if arena_name else None,
        'updated_at': datetime.now(pytz.UTC).isoformat()  # Current UTC time
    }
    
    # Only include team IDs if they exist
    if home_team_id:
        schedule_data['home_team_id'] = int(home_team_id)
    if away_team_id:
        schedule_data['away_team_id'] = int(away_team_id)
    
    return schedule_data


def sync_schedule_for_date_range(start_date_str: str, end_date_str: str, season: Optional[str] = None) -> None:
    """
    Sync game schedule information for a date range.
    
    Fetches schedule data (date, time, arena, status) for all games in the range
    and updates the games table. Does NOT update scores or player stats.
    
    Args:
        start_date_str: Start date in 'YYYY-MM-DD' format
        end_date_str: End date in 'YYYY-MM-DD' format
        season: NBA season (e.g., '2024-25'). If None, uses current season.
    """
    try:
        print(f"Starting schedule sync for date range: {start_date_str} to {end_date_str}")
        
        # Parse dates
        try:
            start_date = datetime.strptime(start_date_str, '%Y-%m-%d')
            end_date = datetime.strptime(end_date_str, '%Y-%m-%d')
        except ValueError:
            print("❌ Invalid date format. Expected YYYY-MM-DD")
            return
        
        # Localize to US Eastern (NBA timezone)
        est_tz = pytz.timezone('US/Eastern')
        start_date = est_tz.localize(start_date)
        end_date = est_tz.localize(end_date)
        
        # Get season
        if season is None:
            season = get_current_nba_season()
        print(f"NBA season: {season}")
        
        # Get Supabase client
        supabase = get_db()
        
        # Build team maps
        _, nba_team_id_to_db_id = _build_team_map()
        if not nba_team_id_to_db_id:
            print("⚠️ Warning: No teams found in database. Please sync teams first.")
            return
        
        # Get all game IDs for the date range
        print(f"Fetching game IDs for date range...")
        game_ids = _get_game_ids_for_date_range(start_date, end_date)
        
        if not game_ids:
            print(f"ℹ️ No games found for date range {start_date_str} to {end_date_str}")
            return
        
        print(f"Found {len(game_ids)} games to sync")
        
        # Fetch and transform schedule data for each game
        schedule_data_list: List[Dict] = []
        skipped_count = 0
        failed_count = 0
        
        for i, game_id in enumerate(game_ids, 1):
            if i % 10 == 0:
                print(f"  Processing game {i}/{len(game_ids)}...")
            
            schedule_data = _fetch_game_schedule_info(game_id, nba_team_id_to_db_id)
            
            if schedule_data:
                schedule_data['season'] = season  # Add season
                schedule_data_list.append(schedule_data)
            else:
                skipped_count += 1
                if skipped_count <= 3:
                    print(f"  ⚠️ Skipped game {game_id} (failed to fetch schedule info)")
        
        if skipped_count > 0:
            print(f"Skipped {skipped_count} games (failed to fetch schedule info)")
        
        if not schedule_data_list:
            print("ℹ️ No valid schedule data to sync")
            return
        
        print(f"Syncing {len(schedule_data_list)} games to Supabase...")
        
        # Upsert to Supabase (only updates schedule fields, preserves scores if they exist)
        synced_count = 0
        try:
            # Try bulk upsert first
            result = supabase.table('games').upsert(
                schedule_data_list,
                on_conflict='id'
            ).execute()
            synced_count = len(schedule_data_list)
            print(f"✅ Successfully synced {synced_count} games")
        except Exception as bulk_error:
            print(f"⚠️ Bulk upsert failed, trying individual upserts...")
            print(f"Error: {bulk_error}")
            
            # Fallback to individual upserts
            for schedule_data in schedule_data_list:
                try:
                    supabase.table('games').upsert(schedule_data, on_conflict='id').execute()
                    synced_count += 1
                except Exception as e:
                    failed_count += 1
                    if failed_count <= 3:
                        print(f"  ❌ Failed to upsert game {schedule_data.get('id', 'unknown')}: {e}")
        
        # Verify
        print("\nVerifying data insertion...")
        date_start = f"{start_date_str}T00:00:00+00:00"
        date_end = f"{end_date_str}T23:59:59+00:00"
        verify_result = supabase.table('games').select(
            'id, game_datetime, is_time_tbd, status, arena_name'
        ).gte('game_datetime', date_start).lte('game_datetime', date_end).limit(5).execute()

        if verify_result.data:
            print(f"✅ Verification successful! Found games in database")
            print("Sample games:")
            for game in verify_result.data[:3]:
                game_dt = game.get('game_datetime', 'N/A')
                is_tbd = game.get('is_time_tbd', False)
                arena = game.get('arena_name', 'N/A')
                tbd_str = " (TBD)" if is_tbd else ""
                print(f"  - Game {game['id']}: {game_dt}{tbd_str}, {game['status']}, Arena: {arena}")
        
        print(f"\n✅ Schedule sync completed!")
        print(f"  Total games synced: {synced_count}")
        if failed_count > 0:
            print(f"  Total games failed: {failed_count}")
        
    except Exception as e:
        print(f"\n❌ Error during schedule sync: {str(e)}")
        import traceback
        traceback.print_exc()
        raise


def sync_schedule_for_season(season: Optional[str] = None) -> None:
    """
    Sync game schedule information for the entire season.
    
    Args:
        season: NBA season (e.g., '2024-25'). If None, uses current season.
    """
    if season is None:
        season = get_current_nba_season()
    
    # NBA season typically runs from October to June
    # For season '2024-25', start date is October 2024, end date is June 2025
    year = int(season.split('-')[0])
    start_date_str = f"{year}-10-01"  # October 1
    end_date_str = f"{year + 1}-06-30"  # June 30 of next year
    
    print(f"Syncing schedule for season {season} ({start_date_str} to {end_date_str})...")
    sync_schedule_for_date_range(start_date_str, end_date_str, season)


def sync_schedule_for_date(date_str: str, season: Optional[str] = None) -> None:
    """
    Sync game schedule information for a single date.
    
    Args:
        date_str: Date in 'YYYY-MM-DD' format
        season: NBA season (e.g., '2024-25'). If None, uses current season.
    """
    sync_schedule_for_date_range(date_str, date_str, season)
