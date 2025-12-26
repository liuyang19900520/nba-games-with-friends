"""
Game synchronization service.
Fetches NBA game data and syncs to Supabase games table.
Handles US "Yesterday" (Tokyo "Today") and US "Today" (Tokyo "Tomorrow") games.
"""
from datetime import datetime, timedelta
from typing import Dict, Optional, Tuple
import pytz

from nba_api.stats.endpoints import scoreboardv2
from db import get_db
from utils import get_current_nba_season, safe_call_nba_api


def _build_team_map() -> Tuple[Dict[str, str], Dict[str, str]]:
    """
    Build mapping dictionaries for team lookups.
    
    Returns:
        Tuple of:
        - Dict mapping tricode (e.g., 'LAL') to database team ID (e.g., '1610612747')
        - Dict mapping NBA team ID (e.g., '1610612747') to tricode (e.g., 'LAL')
    """
    supabase = get_db()
    print("Fetching teams from Supabase to build team mapping...")
    
    teams_result = supabase.table('teams').select('id, code').execute()
    
    if not teams_result.data:
        print("⚠️ Warning: No teams found in database. Please sync teams first.")
        return {}, {}
    
    # Map: tricode -> database team_id (for lookup by tricode)
    tricode_to_id: Dict[str, str] = {}
    # Map: NBA team_id -> tricode (for lookup by NBA team_id when LineScore is empty)
    team_id_to_tricode: Dict[str, str] = {}
    
    for team in teams_result.data:
        code = team.get('code', '').strip().upper()
        team_id = team.get('id')
        if code and team_id:
            team_id_str = str(team_id)
            tricode_to_id[code] = team_id_str
            team_id_to_tricode[team_id_str] = code
    
    print(f"✅ Built team map with {len(tricode_to_id)} teams")
    return tricode_to_id, team_id_to_tricode


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


def _fetch_games_for_date(day_offset: int, team_id_to_tricode: Optional[Dict[str, str]] = None) -> Optional[list]:
    """
    Fetch games for a specific date using NBA API.
    
    Args:
        day_offset: -1 for US Yesterday, 0 for US Today
    
    Returns:
        List of game dictionaries, or None if fetch failed
    """
    us_eastern = pytz.timezone('US/Eastern')
    target_date = datetime.now(us_eastern) + timedelta(days=day_offset)
    date_str = target_date.strftime('%Y-%m-%d')
    date_str_v2 = target_date.strftime('%m/%d/%Y')  # Format for ScoreboardV2
    
    print(f"Fetching games for US {'Yesterday' if day_offset == -1 else 'Today'} ({date_str})...")
    
    # Use ScoreboardV2 for both yesterday and today, as it supports date parameter
    # and is more reliable than the live endpoint which may return stale data
    scoreboard_obj = safe_call_nba_api(
        name=f"ScoreboardV2 for {date_str}",
        call_fn=lambda: scoreboardv2.ScoreboardV2(game_date=date_str_v2),
        max_retries=3,
        base_delay=3.0,
    )
    
    if scoreboard_obj is None:
        print(f"[game_service] Failed to fetch games for {date_str} after retries. "
              "Skipping this date.")
        return None
    
    # ScoreboardV2 returns data in a different format
    data = scoreboard_obj.get_dict()
    result_sets = data.get('resultSets', [])
    
    if not result_sets or len(result_sets) == 0:
        return []
    
    # ResultSet 0: GameHeader - contains game info
    game_header = result_sets[0] if len(result_sets) > 0 else None
    # ResultSet 1: LineScore - contains team info with tricodes and scores
    line_score = result_sets[1] if len(result_sets) > 1 else None
    
    if not game_header or not line_score:
        return []
    
    game_headers = game_header.get('headers', [])
    game_rows = game_header.get('rowSet', [])
    line_headers = line_score.get('headers', [])
    line_rows = line_score.get('rowSet', [])
    
    # Build a mapping from game_id + team_id to team info (tricode, score)
    team_info_map: Dict[tuple, dict] = {}
    for line_row in line_rows:
        line_dict = {}
        for i, header in enumerate(line_headers):
            if i < len(line_row):
                line_dict[header] = line_row[i]
        
        game_id = line_dict.get('GAME_ID')
        team_id = line_dict.get('TEAM_ID')
        tricode = line_dict.get('TEAM_ABBREVIATION', '').strip().upper()
        score = line_dict.get('PTS')
        
        if game_id and team_id:
            team_info_map[(game_id, team_id)] = {
                'tricode': tricode,
                'score': int(score) if score is not None and score != '' else None
            }
    
    # Convert game rows to match live endpoint format
    games = []
    for game_row in game_rows:
        game_dict = {}
        for i, header in enumerate(game_headers):
            if i < len(game_row):
                game_dict[header] = game_row[i]
        
        game_id = game_dict.get('GAME_ID')
        if not game_id:
            continue
        
        home_team_id = game_dict.get('HOME_TEAM_ID')
        visitor_team_id = game_dict.get('VISITOR_TEAM_ID')
        
        # Get team info from line score
        home_info = team_info_map.get((game_id, home_team_id), {})
        away_info = team_info_map.get((game_id, visitor_team_id), {})
        
        # If LineScore is empty (scheduled games), use team_id_to_tricode mapping
        if not home_info.get('tricode') and team_id_to_tricode:
            home_team_id_str = str(home_team_id)
            home_tricode = team_id_to_tricode.get(home_team_id_str, '')
            if home_tricode:
                home_info['tricode'] = home_tricode
        
        if not away_info.get('tricode') and team_id_to_tricode:
            visitor_team_id_str = str(visitor_team_id)
            away_tricode = team_id_to_tricode.get(visitor_team_id_str, '')
            if away_tricode:
                away_info['tricode'] = away_tricode
        
        # Parse game date and convert to UTC format
        game_date_est = game_dict.get('GAME_DATE_EST', '')
        # GAME_DATE_EST is in format "2024-12-24T20:00:00"
        # We need to convert EST to UTC (EST is UTC-5, EDT is UTC-4)
        game_time_utc = game_date_est
        if game_date_est:
            try:
                # Parse EST date
                dt_est = datetime.strptime(game_date_est, '%Y-%m-%dT%H:%M:%S')
                # Localize to EST (we'll treat as EST, not EDT for simplicity)
                # In practice, NBA games are scheduled in local time, so this is approximate
                est_tz = pytz.timezone('US/Eastern')
                dt_est = est_tz.localize(dt_est)
                # Convert to UTC
                dt_utc = dt_est.astimezone(pytz.UTC)
                game_time_utc = dt_utc.isoformat()
            except Exception:
                # If parsing fails, use as-is
                pass
        
        # Transform to match live endpoint structure
        game = {
            'gameId': str(game_id),
            'gameTimeUTC': game_time_utc,
            'gameStatus': game_dict.get('GAME_STATUS_ID', 1),
            'homeTeam': {
                'tricode': home_info.get('tricode', ''),
                'score': home_info.get('score')
            },
            'awayTeam': {
                'tricode': away_info.get('tricode', ''),
                'score': away_info.get('score')
            },
            'arena': {
                'name': game_dict.get('ARENA_NAME', '')
            },
            'seasonYear': game_dict.get('SEASON', '')
        }
        games.append(game)
    
    return games


def _transform_game_data(game: dict, team_map: Dict[str, str], season: str) -> Optional[dict]:
    """
    Transform NBA API game data to Supabase games table format.
    
    Args:
        game: Game dictionary from NBA API
        team_map: Mapping from tricode to team UUID
        season: Current NBA season (e.g., '2024-25')
    
    Returns:
        Transformed game dictionary, or None if transformation failed
    """
    game_id = game.get('gameId')
    if not game_id:
        return None
    
    # Get team tricodes
    home_tricode = game.get('homeTeam', {}).get('tricode', '').strip().upper()
    away_tricode = game.get('awayTeam', {}).get('tricode', '').strip().upper()
    
    # Look up team IDs
    home_team_id = team_map.get(home_tricode)
    away_team_id = team_map.get(away_tricode)
    
    if not home_team_id or not away_team_id:
        return None  # Skip games with missing team mappings
    
    # Get game time (UTC)
    game_time_utc = game.get('gameTimeUTC', '')
    if not game_time_utc:
        return None
    
    # Parse and format UTC datetime
    # The API might return different formats, handle both
    try:
        if 'T' in game_time_utc:
            # ISO format: "2024-12-24T20:00:00Z" or "2024-12-24T20:00:00"
            dt = datetime.fromisoformat(game_time_utc.replace('Z', '+00:00'))
        else:
            # Date only: "2024-12-24"
            dt = datetime.strptime(game_time_utc, '%Y-%m-%d')
            # Set to noon UTC if no time provided
            dt = dt.replace(hour=12, minute=0, second=0)
            dt = pytz.UTC.localize(dt)
        
        # Ensure it's timezone-aware (UTC)
        if dt.tzinfo is None:
            dt = pytz.UTC.localize(dt)
        else:
            dt = dt.astimezone(pytz.UTC)
        
        game_date_iso = dt.isoformat()
    except Exception:
        return None  # Skip games with invalid dates
    
    # Get status
    status_code = game.get('gameStatus', 1)
    status = _map_game_status(status_code)
    
    # Get scores (only if available)
    home_score = game.get('homeTeam', {}).get('score')
    away_score = game.get('awayTeam', {}).get('score')
    
    # Get arena name
    arena_name = game.get('arena', {}).get('name', '')
    
    # Build game data
    game_data = {
        'id': str(game_id),
        'season': season,
        'game_date': game_date_iso,
        'status': status,
        'home_team_id': home_team_id,
        'away_team_id': away_team_id,
        'arena_name': arena_name if arena_name else None
    }
    
    # Only include scores if they exist
    if home_score is not None:
        game_data['home_score'] = int(home_score)
    if away_score is not None:
        game_data['away_score'] = int(away_score)
    
    return game_data


def sync_games() -> None:
    """
    Sync games from NBA API to Supabase games table.
    
    Fetches games for:
    - US "Yesterday" (Tokyo "Today") - mostly Final games
    - US "Today" (Tokyo "Tomorrow") - mostly Scheduled games
    
    Extracts game info:
    - id, season, game_date, status, home_team_id, away_team_id,
      home_score, away_score, arena_name
    """
    try:
        print("Starting game sync...")
        
        # Get current NBA season
        season = get_current_nba_season()
        print(f"Current NBA season: {season}")
        
        # Get Supabase client
        supabase = get_db()
        
        # Build team maps (tricode->id and team_id->tricode)
        tricode_to_id, team_id_to_tricode = _build_team_map()
        if not tricode_to_id:
            print("⚠️ Warning: No teams found in database. Please sync teams first.")
            return
        
        total_synced = 0
        total_failed = 0
        
        # Sync games for both dates
        for day_offset in [-1, 0]:
            day_label = "Yesterday" if day_offset == -1 else "Today"
            tokyo_label = "Today" if day_offset == -1 else "Tomorrow"
            
            print(f"\nSyncing games for US {day_label} (Tokyo {tokyo_label})...")
            
            # Fetch games from NBA API (pass team_id_to_tricode for scheduled games)
            games = _fetch_games_for_date(day_offset, team_id_to_tricode)
            
            if games is None:
                print(f"  ⚠️ Failed to fetch games for US {day_label}. Skipping.")
                continue
            
            if len(games) == 0:
                print(f"  ℹ️ No games found for US {day_label}")
                continue
            
            print(f"  Fetched {len(games)} games from NBA API")
            
            # Transform games data
            games_data = []
            skipped_count = 0
            
            for game in games:
                game_data = _transform_game_data(game, tricode_to_id, season)
                if game_data:
                    games_data.append(game_data)
                else:
                    skipped_count += 1
            
            if skipped_count > 0:
                print(f"  Skipped {skipped_count} games (missing team mapping or invalid data)")
            
            if len(games_data) == 0:
                print(f"  ℹ️ No valid games to sync for US {day_label}")
                continue
            
            # Upsert games to Supabase
            print(f"  Syncing {len(games_data)} games to Supabase...")
            synced_count = 0
            failed_count = 0
            
            try:
                # Try bulk upsert first
                result = supabase.table('games').upsert(
                    games_data,
                    on_conflict='id'
                ).execute()
                synced_count = len(games_data)
                print(f"  ✅ Successfully upserted {synced_count} games")
                
            except Exception as bulk_error:
                # If bulk upsert fails, try one by one
                print(f"  ⚠️ Bulk upsert failed, trying individual upserts...")
                
                for game_data in games_data:
                    try:
                        supabase.table('games').upsert(
                            game_data,
                            on_conflict='id'
                        ).execute()
                        synced_count += 1
                    except Exception as e:
                        failed_count += 1
                        if failed_count <= 3:
                            print(f"    ❌ Failed to upsert game {game_data.get('id')}: {e}")
                
                if synced_count > 0:
                    print(f"  ✅ Upserted {synced_count}/{len(games_data)} games")
                else:
                    print(f"  ❌ Failed to upsert any games for US {day_label}")
                    total_failed += len(games_data)
                    continue
            
            total_synced += synced_count
            total_failed += failed_count
        
        # Summary
        print(f"\n{'='*60}")
        print(f"Game sync completed!")
        print(f"  Total games synced: {total_synced}")
        if total_failed > 0:
            print(f"  Total games failed: {total_failed}")
        print(f"{'='*60}")
        
        # Verify data insertion
        print("\nVerifying data insertion...")
        verify_result = supabase.table('games').select(
            'id, season, game_date, status, home_team_id, away_team_id'
        ).eq('season', season).limit(5).execute()
        
        if verify_result.data:
            print(f"✅ Verification successful! Found games in database")
            print("Sample games:")
            for game in verify_result.data[:3]:
                print(f"  - Game {game['id']}: {game['status']} on {game['game_date']}")
        else:
            print("⚠️ Warning: No games found in database after insertion")
        
        print("\n✅ Game sync completed successfully!")
        
    except Exception as e:
        print(f"\n❌ Error during game sync: {str(e)}")
        import traceback
        traceback.print_exc()
        raise

