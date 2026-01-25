"""
Game synchronization service.
Fetches NBA game data and syncs to Supabase games table.
Handles US "Yesterday" (Tokyo "Today") and US "Today" (Tokyo "Tomorrow") games.

Key data model change (2026-01):
- game_datetime: TIMESTAMPTZ - Combined date+time in UTC
- is_time_tbd: BOOLEAN - True when game time is not yet announced
"""
from datetime import datetime, timedelta
from typing import Dict, Optional, Tuple
import pytz

from nba_api.stats.endpoints import scoreboardv2, boxscoresummaryv3
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


def _fetch_games_for_date(day_offset: Optional[int] = None, team_id_to_tricode: Optional[Dict[str, str]] = None, date_str: Optional[str] = None) -> Optional[list]:
    """
    Fetch games for a specific date using NBA API.
    
    Args:
        day_offset: -1 for US Yesterday, 0 for US Today (optional if date_str is provided)
        team_id_to_tricode: Optional mapping from team ID to tricode for scheduled games
        date_str: Date string in 'YYYY-MM-DD' format (optional, if not provided, uses day_offset)
    
    Returns:
        List of game dictionaries, or None if fetch failed
    """
    if date_str:
        # Parse the provided date string (assume US Eastern timezone)
        try:
            target_date = datetime.strptime(date_str, '%Y-%m-%d')
            us_eastern = pytz.timezone('US/Eastern')
            target_date = us_eastern.localize(target_date)
            date_label = date_str
        except ValueError:
            print(f"[game_service] Invalid date format: {date_str}. Expected YYYY-MM-DD")
            return None
    else:
        # Use day_offset to calculate date
        if day_offset is None:
            print("[game_service] Either day_offset or date_str must be provided")
            return None
        us_eastern = pytz.timezone('US/Eastern')
        target_date = datetime.now(us_eastern) + timedelta(days=day_offset)
        date_label = target_date.strftime('%Y-%m-%d')
    
    date_str_formatted = target_date.strftime('%Y-%m-%d')
    date_str_v2 = target_date.strftime('%m/%d/%Y')  # Format for ScoreboardV2
    
    if day_offset is not None:
        print(f"Fetching games for US {'Yesterday' if day_offset == -1 else 'Today'} ({date_str_formatted})...")
    else:
        print(f"Fetching games for date {date_label}...")
    
    # Use ScoreboardV2 for both yesterday and today, as it supports date parameter
    # and is more reliable than the live endpoint which may return stale data
    scoreboard_obj = safe_call_nba_api(
        name=f"ScoreboardV2 for {date_str_formatted}",
        call_fn=lambda: scoreboardv2.ScoreboardV2(game_date=date_str_v2),
        max_retries=3,
        base_delay=3.0,
    )
    
    if scoreboard_obj is None:
        print(f"[game_service] Failed to fetch games for {date_str_formatted} after retries. "
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
        game_status_text = game_dict.get('GAME_STATUS_TEXT', '').strip()
        
        # GAME_DATE_EST is often just midnight, e.g. "2026-01-24T00:00:00"
        # We try to extract the time from GAME_STATUS_TEXT if it looks like "7:00 pm ET"
        game_time_utc = game_date_est
        
        try:
            # 1. Base date from GAME_DATE_EST
            if game_date_est:
                dt_est = datetime.strptime(game_date_est, '%Y-%m-%dT%H:%M:%S')
            else:
                dt_est = datetime.now()

            # 2. Try to parse specific time from GAME_STATUS_TEXT (e.g. "7:30 pm ET")
            # Only for Scheduled games (Status 1)
            time_found = False
            if game_dict.get('GAME_STATUS_ID') == 1 and 'pm' in game_status_text.lower() and 'ET' in game_status_text:
                try:
                    # Format: "7:30 pm ET"
                    time_part = game_status_text.replace('ET', '').strip()
                    # Parse "7:30 pm"
                    t = datetime.strptime(time_part, '%I:%M %p').time()
                    dt_est = dt_est.replace(hour=t.hour, minute=t.minute, second=0)
                    time_found = True
                except ValueError:
                    pass
            
            # If no time found in status text, and GAME_DATE_EST was midnight, 
            # we effectively default to 00:00:00 (which is wrong but better than crash)
            
            # 3. Timezone Conversion (EST -> UTC)
            est_tz = pytz.timezone('US/Eastern')
            dt_est = est_tz.localize(dt_est)
            dt_utc = dt_est.astimezone(pytz.UTC)
            game_time_utc = dt_utc.isoformat()
            
        except Exception as e:
            print(f"Error parsing time for game {game_id}: {e}")
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
        # Log missing team mappings for debugging
        missing_teams = []
        if not home_tricode:
            missing_teams.append(f"home team (empty tricode)")
        elif not home_team_id:
            missing_teams.append(f"home team '{home_tricode}'")
        if not away_tricode:
            missing_teams.append(f"away team (empty tricode)")
        elif not away_team_id:
            missing_teams.append(f"away team '{away_tricode}'")
        
        if missing_teams:
            print(f"  ⚠️ Game {game_id}: Missing team mapping for {', '.join(missing_teams)}")
            print(f"     Hint: Run 'python cli.py sync-teams' to update team codes in database")
        
        return None  # Skip games with missing team mappings
    
    # Get game time (UTC)
    game_time_utc = game.get('gameTimeUTC', '')
    if not game_time_utc:
        return None
    
    # Parse and format UTC datetime
    # The API might return different formats, handle both
    is_time_tbd = False
    try:
        if 'T' in game_time_utc:
            # ISO format: "2024-12-24T20:00:00Z" or "2024-12-24T20:00:00"
            dt = datetime.fromisoformat(game_time_utc.replace('Z', '+00:00'))
            # Check if time is midnight (indicates TBD)
            if dt.hour == 0 and dt.minute == 0 and dt.second == 0:
                is_time_tbd = True
        else:
            # Date only: "2024-12-24"
            dt = datetime.strptime(game_time_utc, '%Y-%m-%d')
            # Set to noon UTC if no time provided
            dt = dt.replace(hour=12, minute=0, second=0)
            dt = pytz.UTC.localize(dt)
            is_time_tbd = True  # No time means TBD

        # Ensure it's timezone-aware (UTC)
        if dt.tzinfo is None:
            dt = pytz.UTC.localize(dt)
        else:
            dt = dt.astimezone(pytz.UTC)

        # Store as TIMESTAMPTZ (full datetime with timezone)
        game_datetime = dt
    except Exception:
        return None  # Skip games with invalid dates
    
    # Determine if game is playoff
    # NBA game_id format: 0022500009
    # First 2 digits: 00=Regular Season, 01=Playoffs, 02=All-Star, etc.
    is_playoff = False
    if len(game_id) >= 2:
        game_type = game_id[:2]
        is_playoff = (game_type == '01')  # 01 = Playoffs
    
    # Get status from API
    status_code = game.get('gameStatus', 1)
    status = _map_game_status(status_code)
    
    # Get scores (only if available)
    home_score = game.get('homeTeam', {}).get('score')
    away_score = game.get('awayTeam', {}).get('score')
    
    # IMPORTANT: Smart status correction for past games
    # If game_datetime is in the past and we have scores, it should be 'Final'
    # ScoreboardV2 sometimes returns incorrect status for past games
    now_utc = datetime.now(pytz.UTC)
    if game_datetime < now_utc:
        if home_score is not None and away_score is not None:
            # Has scores = game is finished
            if status != 'Final':
                print(f"  ℹ️ Auto-correcting game {game_id} status: {status} -> Final (past game with scores)")
            status = 'Final'
        elif status == 'Scheduled':
            # Past game without scores but marked as Scheduled - needs investigation
            # Mark for re-fetch with BoxScoreTraditionalV3
            game['_needs_refetch'] = True

    # Get arena name
    arena_name = game.get('arena', {}).get('name', '')

    # Build game data
    # NOTE: During migration period, output BOTH old (game_date/game_time) and new (game_datetime/is_time_tbd)
    game_data = {
        'id': str(game_id),
        'season': season,
        # New columns (TIMESTAMPTZ unified)
        'game_datetime': game_datetime.isoformat(),  # TIMESTAMPTZ (ISO format with timezone)
        'is_time_tbd': is_time_tbd,  # True if game time is not yet announced
        # Legacy columns (for backward compatibility during migration)
        'game_date': game_datetime.date().isoformat(),  # YYYY-MM-DD
        'game_time': game_datetime.time().isoformat(),  # HH:MM:SS
        'status': status,
        'is_playoff': is_playoff,
        'home_team_id': int(home_team_id),
        'away_team_id': int(away_team_id),
        'arena_name': arena_name if arena_name else None,
        'updated_at': datetime.now(pytz.UTC).isoformat()  # Current UTC time
    }

    # Only include scores if they exist
    if home_score is not None:
        game_data['home_score'] = int(home_score)
    if away_score is not None:
        game_data['away_score'] = int(away_score)

    return game_data


def _fetch_single_game_by_id(game_id: str, team_map: Dict[str, str], season: str) -> Optional[dict]:
    """
    Fetch a single game by game ID from NBA API.
    
    Uses BoxScoreTraditionalV3 to get game info.
    
    Args:
        game_id: NBA game ID (e.g., '0022500009')
        team_map: Mapping from tricode to team UUID
        season: Current NBA season (e.g., '2024-25')
    
    Returns:
        Transformed game dictionary, or None if fetch failed
    """
    from nba_api.stats.endpoints import boxscoretraditionalv3
    
    print(f"Fetching game {game_id} from NBA API...")
    
    # Use BoxScoreTraditionalV3 to get game info
    boxscore = safe_call_nba_api(
        name=f"BoxScoreTraditionalV3(game_id={game_id})",
        call_fn=lambda: boxscoretraditionalv3.BoxScoreTraditionalV3(game_id=game_id),
        max_retries=3,
        base_delay=3.0,
    )
    
    if boxscore is None:
        print(f"[game_service] Failed to fetch game {game_id} after retries.")
        return None
    
    data = boxscore.get_dict()
    box_score_data = data.get('boxScoreTraditional', {})
    
    if not box_score_data:
        print(f"[game_service] No game data found for game {game_id}")
        return None
    
    # Extract game info from boxscore (may not exist if game hasn't started)
    game_info = box_score_data.get('game', {})
    
    # Get team IDs from boxscore (these should always be available)
    home_team_id_api = box_score_data.get('homeTeamId')
    away_team_id_api = box_score_data.get('awayTeamId')
    
    if not home_team_id_api or not away_team_id_api:
        print(f"[game_service] Missing team IDs in boxscore for game {game_id}")
        return None
    
    home_team_id_api = str(home_team_id_api)
    away_team_id_api = str(away_team_id_api)
    
    # Get team tricodes - we need to look them up from teams table
    supabase = get_db()
    home_team_result = supabase.table('teams').select('id, code').eq('id', int(home_team_id_api)).execute()
    away_team_result = supabase.table('teams').select('id, code').eq('id', int(away_team_id_api)).execute()
    
    if not home_team_result.data or not away_team_result.data:
        print(f"[game_service] Could not find teams in database for game {game_id}")
        return None
    
    home_tricode = home_team_result.data[0].get('code', '').strip().upper()
    away_tricode = away_team_result.data[0].get('code', '').strip().upper()
    
    # Look up team IDs from team_map
    home_team_id = team_map.get(home_tricode)
    away_team_id = team_map.get(away_tricode)
    
    if not home_team_id or not away_team_id:
        print(f"[game_service] Could not map teams for game {game_id}")
        return None
    
    # Get game time
    game_time_utc = ''
    if game_info:
        game_time_utc = game_info.get('gameTimeUTC', '')
        if not game_time_utc:
            # Try to get from game date
            game_date = game_info.get('gameDateEst', '')
            if game_date:
                game_time_utc = game_date + 'T00:00:00Z'
    
    # If no game info, try to get from database (game might already exist)
    if not game_time_utc:
        supabase = get_db()
        existing_game = supabase.table('games').select('game_datetime').eq('id', game_id).execute()
        if existing_game.data:
            existing_data = existing_game.data[0]
            game_datetime_str = existing_data.get('game_datetime', '')
            if game_datetime_str:
                game_time_utc = game_datetime_str

        # If still no game time, use current date as fallback
        if not game_time_utc:
            print(f"[game_service] Warning: No game time found for game {game_id}, using current date")
            dt = datetime.now(pytz.UTC)
            game_time_utc = dt.isoformat()

    # Parse and format UTC datetime
    is_time_tbd = False
    try:
        if 'T' in game_time_utc:
            dt = datetime.fromisoformat(game_time_utc.replace('Z', '+00:00'))
            # Check if time is midnight (indicates TBD)
            if dt.hour == 0 and dt.minute == 0 and dt.second == 0:
                is_time_tbd = True
        else:
            dt = datetime.strptime(game_time_utc, '%Y-%m-%d')
            dt = dt.replace(hour=12, minute=0, second=0)
            dt = pytz.UTC.localize(dt)
            is_time_tbd = True  # No time means TBD

        if dt.tzinfo is None:
            dt = pytz.UTC.localize(dt)
        else:
            dt = dt.astimezone(pytz.UTC)

        # Store as TIMESTAMPTZ (full datetime with timezone)
        game_datetime = dt
    except Exception as e:
        print(f"[game_service] Error parsing game time for game {game_id}: {e}")
        return None
    
    # Determine if game is playoff
    # NBA game_id format: 0022500009
    # First 2 digits: 00=Regular Season, 01=Playoffs, 02=All-Star, etc.
    is_playoff = False
    if len(game_id) >= 2:
        game_type = game_id[:2]
        is_playoff = (game_type == '01')  # 01 = Playoffs
    
    # Get status - if we have boxscore, game is likely Final or Live
    if game_info:
        status_code = game_info.get('gameStatus', 3)  # Default to Final if we have stats
        status = _map_game_status(status_code)
    else:
        # If no game info but we have boxscore, game is likely Final
        status = 'Final'
    
    # Get scores from team stats
    home_team_stats = box_score_data.get('homeTeam', {}).get('statistics', {})
    away_team_stats = box_score_data.get('awayTeam', {}).get('statistics', {})
    home_score = home_team_stats.get('points') if home_team_stats else None
    away_score = away_team_stats.get('points') if away_team_stats else None
    
    # FALLBACK: If scores are missing, try BoxScoreSummaryV3 (for Live games where TraditionalV3 lags)
    if home_score is None or away_score is None:
        print(f"[game_service] Scores missing in TraditionalV3 for {game_id}, trying BoxScoreSummaryV3...")
        try:
            from nba_api.stats.endpoints import boxscoresummaryv3
            summary_obj = safe_call_nba_api(
                name=f"BoxScoreSummaryV3({game_id})",
                call_fn=lambda: boxscoresummaryv3.BoxScoreSummaryV3(game_id=game_id),
                max_retries=2
            )
            if summary_obj:
                sum_data = summary_obj.get_dict().get('boxScoreSummary', {})
                sum_home = sum_data.get('homeTeam', {})
                sum_away = sum_data.get('awayTeam', {})
                
                # Extract new scores
                new_home_score = sum_home.get('score')
                new_away_score = sum_away.get('score')
                
                if new_home_score is not None:
                    home_score = new_home_score
                if new_away_score is not None:
                    away_score = new_away_score
                
                # If we have scores now, ensure status is at least Live
                if home_score is not None and status == 'Scheduled':
                    status = 'Live'
                    status_text = sum_data.get('gameStatusText', '')
                    print(f"  ℹ️  Upgraded status to Live based on SummaryV3 scores (Status: {status_text})")

        except ImportError:
            print("[game_service] BoxScoreSummaryV3 not available in this nba_api version")
        except Exception as e:
            print(f"  ⚠️ BoxScoreSummaryV3 fallback failed: {e}")
    
    # Get arena name
    arena_name = ''
    if game_info:
        arena_name = game_info.get('arenaName', '')

    # Build game data
    # NOTE: During migration period, output BOTH old (game_date/game_time) and new (game_datetime/is_time_tbd)
    # This allows gradual migration. After all consumers are updated, remove old columns.
    game_data = {
        'id': str(game_id),
        'season': season,
        # New columns (TIMESTAMPTZ unified)
        'game_datetime': game_datetime.isoformat(),  # TIMESTAMPTZ (ISO format with timezone)
        'is_time_tbd': is_time_tbd,  # True if game time is not yet announced
        # Legacy columns (for backward compatibility during migration)
        'game_date': game_datetime.date().isoformat(),  # YYYY-MM-DD
        'game_time': game_datetime.time().isoformat(),  # HH:MM:SS
        'status': status,
        'is_playoff': is_playoff,
        'home_team_id': int(home_team_id),
        'away_team_id': int(away_team_id),
        'arena_name': arena_name if arena_name else None,
        'updated_at': datetime.now(pytz.UTC).isoformat()  # Current UTC time
    }

    # Only include scores if they exist
    if home_score is not None:
        game_data['home_score'] = int(home_score)
    if away_score is not None:
        game_data['away_score'] = int(away_score)

    return game_data


def sync_single_game(game_id: str) -> None:
    """
    Sync a single game by game ID.
    
    Syncs both:
    - games table (game basic info)
    - game_player_stats table (player statistics)
    
    Args:
        game_id: NBA game ID (e.g., '0022500009')
    """
    try:
        print(f"Starting single game sync for game {game_id}...")
        
        # Get current NBA season
        season = get_current_nba_season()
        print(f"Current NBA season: {season}")
        
        # Get Supabase client
        supabase = get_db()
        
        # Build team maps
        tricode_to_id, _ = _build_team_map()
        if not tricode_to_id:
            print("⚠️ Warning: No teams found in database. Please sync teams first.")
            return
        
        # Fetch and sync game basic info
        print(f"Fetching game {game_id} info...")
        game_data = _fetch_single_game_by_id(game_id, tricode_to_id, season)
        
        if not game_data:
            error_msg = f"Failed to fetch game {game_id} from NBA API. Game may not exist or may not have started yet."
            print(f"❌ {error_msg}")
            raise Exception(error_msg)
        
    # Fetch old status to detect changes
        old_status = 'Unknown'
        try:
            old_game = supabase.table('games').select('status').eq('id', game_id).maybe_single().execute()
            if old_game.data:
                old_status = old_game.data.get('status')
        except Exception:
            pass # Ignore read errors, just assume Unknown

        # Upsert game to Supabase
        print(f"Syncing game {game_id} to games table...")
        try:
            supabase.table('games').upsert(game_data, on_conflict='id').execute()
            print(f"✅ Successfully synced game {game_id} to games table")
        except Exception as e:
            print(f"❌ Failed to sync game {game_id} to games table: {e}")
            raise
        
        # Now sync player stats
        print(f"Syncing player stats for game {game_id}...")
        from services.game_player_stats_service import sync_game_details
        sync_game_details(game_id=game_id)
        
        print(f"✅ Successfully completed sync for game {game_id}")
        
        # Re-fetch final status to ensure we return the most accurate state
        # (in case sync_game_details updated it via fallback)
        final_status = game_data.get("status")
        try:
            final_game = supabase.table('games').select('status').eq('id', game_id).maybe_single().execute()
            if final_game.data:
                final_status = final_game.data.get('status')
        except Exception:
            pass

        return {
            "game_id": game_id,
            "old_status": old_status,
            "new_status": final_status,
            "home_score": game_data.get("home_score"),
            "away_score": game_data.get("away_score"),
            "home_team_id": game_data.get("home_team_id"),
            "away_team_id": game_data.get("away_team_id")
        }
        
    except Exception as e:
        error_msg = f"Error during single game sync for {game_id}: {str(e)}"
        print(f"\n❌ {error_msg}")
        import traceback
        traceback.print_exc()
        raise Exception(error_msg) from e


def sync_games_for_date(date_str: str, sync_player_stats: bool = False) -> None:
    """
    Sync games for a specific date from NBA API to Supabase games table.
    
    Args:
        date_str: Date string in 'YYYY-MM-DD' format (e.g., '2025-01-06')
        sync_player_stats: If True, also sync player stats for completed games (status='Final')
    
    Extracts game info:
    - id, season, game_datetime, is_time_tbd, status, home_team_id, away_team_id,
      home_score, away_score, arena_name
    """
    try:
        print(f"Starting game sync for date {date_str}...")
        
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
        
        # Fetch games from NBA API for the specified date
        games = _fetch_games_for_date(date_str=date_str, team_id_to_tricode=team_id_to_tricode)
        
        if games is None:
            print(f"  ❌ Failed to fetch games for {date_str}. Exiting.")
            raise Exception(f"Failed to fetch games for date {date_str}")
        
        if len(games) == 0:
            print(f"  ℹ️ No games found for {date_str}")
            return
        
        print(f"  Fetched {len(games)} games from NBA API")
        
        # Transform games data
        games_data = []
        games_needing_refetch = []  # Games that need BoxScoreTraditionalV3 to get correct status
        skipped_count = 0
        
        for game in games:
            game_data = _transform_game_data(game, tricode_to_id, season)
            if game_data:
                games_data.append(game_data)
                # Check if this game was marked for re-fetch OR is Live
                # ScoreboardV2 can be laggy for Live games, so we force a Deep Sync (BoxScoreV3)
                if game.get('_needs_refetch') or game_data['status'] == 'Live':
                    games_needing_refetch.append(game_data['id'])
            else:
                skipped_count += 1
        
        if skipped_count > 0:
            print(f"  Skipped {skipped_count} games (missing team mapping or invalid data)")
        
        if len(games_data) == 0:
            print(f"  ℹ️ No valid games to sync for {date_str}")
            return
        
        # Re-fetch games that have status='Scheduled' but are in the past
        # This happens when ScoreboardV2 returns incorrect status
        if games_needing_refetch:
            print(f"  📡 Re-fetching {len(games_needing_refetch)} games with BoxScoreTraditionalV3 for accurate status...")
            for game_id in games_needing_refetch:
                try:
                    refetched_data = _fetch_single_game_by_id(game_id, tricode_to_id, season)
                    if refetched_data:
                        # Replace the game data with the re-fetched data
                        for i, gd in enumerate(games_data):
                            if gd['id'] == game_id:
                                games_data[i] = refetched_data
                                print(f"    ✅ Game {game_id}: status={refetched_data.get('status')}, home_score={refetched_data.get('home_score')}, away_score={refetched_data.get('away_score')}")
                                break
                except Exception as e:
                    print(f"    ⚠️ Failed to re-fetch game {game_id}: {e}")
        
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
            print(f"  ✅ Successfully synced {synced_count} games")
        except Exception as bulk_error:
            print(f"  ⚠️ Bulk upsert failed, trying individual upserts...")
            print(f"  Error: {bulk_error}")
            
            # Fallback to individual upserts
            for game_data in games_data:
                try:
                    supabase.table('games').upsert(game_data, on_conflict='id').execute()
                    synced_count += 1
                except Exception as e:
                    failed_count += 1
                    if failed_count <= 3:
                        print(f"  ❌ Failed to upsert game {game_data.get('id', 'unknown')}: {e}")
        
        # Verify
        print("\nVerifying data insertion...")
        # Use date range query on game_datetime (TIMESTAMPTZ)
        date_start = f"{date_str}T00:00:00+00:00"
        date_end = f"{date_str}T23:59:59+00:00"
        verify_result = supabase.table('games').select('id, status, game_datetime').gte('game_datetime', date_start).lte('game_datetime', date_end).limit(5).execute()
        if verify_result.data:
            print(f"  ✅ Verification successful! Found games in database for {date_str}")
            print("  Sample games:")
            for game in verify_result.data[:3]:
                print(f"    - Game {game['id']}: {game['status']}")
        
        # Optionally sync player stats for completed games
        stats_synced_count = 0
        stats_failed_count = 0
        stats_skipped_count = 0
        
        if sync_player_stats and synced_count > 0:
            print(f"\n{'='*60}")
            print(f"Syncing player stats for completed games...")
            print(f"{'='*60}")
            
            from services.game_player_stats_service import sync_game_details
            
            # Check if the date is in the past
            try:
                sync_date = datetime.strptime(date_str, '%Y-%m-%d').date()
                today = datetime.now(pytz.UTC).date()
                is_past_date = sync_date < today
            except:
                is_past_date = False
            
            # Get all synced game IDs
            for game_data in games_data:
                game_id = game_data.get('id')
                game_status = game_data.get('status', '')
                
                # Sync stats for:
                # 1. Games with status='Final'
                # 2. OR past games (even if status is wrong, they should have been played)
                should_sync = game_status == 'Final' or is_past_date
                
                if should_sync and game_id:
                    try:
                        if game_status != 'Final' and is_past_date:
                            print(f"  Syncing player stats for game {game_id} (past game, status={game_status})...")
                        else:
                            print(f"  Syncing player stats for game {game_id}...")
                        sync_game_details(game_id=game_id)
                        stats_synced_count += 1
                    except Exception as e:
                        stats_failed_count += 1
                        print(f"  ⚠️ Failed to sync player stats for game {game_id}: {e}")
                        # Continue with other games even if one fails
                elif game_status != 'Final' and not is_past_date:
                    stats_skipped_count += 1
                    print(f"  ℹ️ Skipping game {game_id} (status: {game_status}, not Final, future game)")
        
        print(f"\n{'='*60}")
        print(f"Game sync for {date_str} completed!")
        print(f"  Total games synced: {synced_count}")
        if failed_count > 0:
            print(f"  Total games failed: {failed_count}")
        if sync_player_stats:
            print(f"  Player stats synced: {stats_synced_count}")
            if stats_failed_count > 0:
                print(f"  Player stats failed: {stats_failed_count}")
            if stats_skipped_count > 0:
                print(f"  Player stats skipped (future games): {stats_skipped_count}")
        print(f"{'='*60}")
        
    except Exception as e:
        print(f"\n❌ Error during game sync for {date_str}: {str(e)}")
        import traceback
        traceback.print_exc()
        raise


def sync_games() -> None:
    """
    Sync games from NBA API to Supabase games table.
    
    Fetches games for:
    - US "Yesterday" (Tokyo "Today") - mostly Final games
    - US "Today" (Tokyo "Tomorrow") - mostly Scheduled games

    Extracts game info:
    - id, season, game_datetime, is_time_tbd, status, home_team_id, away_team_id,
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
            games = _fetch_games_for_date(day_offset=day_offset, team_id_to_tricode=team_id_to_tricode)
            
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
            'id, season, game_datetime, status, home_team_id, away_team_id'
        ).eq('season', season).limit(5).execute()

        if verify_result.data:
            print(f"✅ Verification successful! Found games in database")
            print("Sample games:")
            for game in verify_result.data[:3]:
                print(f"  - Game {game['id']}: {game['status']} on {game['game_datetime']}")
        else:
            print("⚠️ Warning: No games found in database after insertion")
        
        print("\n✅ Game sync completed successfully!")
        
    except Exception as e:
        print(f"\n❌ Error during game sync: {str(e)}")
        import traceback
        traceback.print_exc()
        raise

