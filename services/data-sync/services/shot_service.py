"""
Shot chart synchronization service.
Fetches player shot chart data (granular shot locations) from NBA API and syncs to Supabase player_shots table.
"""
from typing import Any, Dict, List, Optional
import pandas as pd
from nba_api.stats.endpoints import shotchartdetail
from db import get_db
from utils import safe_call_nba_api, get_current_nba_season


def _safe_int(value: Any, default: int = 0) -> int:
    """
    Safely convert value to integer.
    
    Args:
        value: Value to convert
        default: Default value if conversion fails
    
    Returns:
        Integer value or default
    """
    if pd.isna(value) or value is None or value == '':
        return default
    try:
        return int(float(value))
    except (ValueError, TypeError):
        return default


def _safe_str(value: Any, default: Optional[str] = None) -> Optional[str]:
    """
    Safely convert value to string.
    
    Args:
        value: Value to convert
        default: Default value if conversion fails
    
    Returns:
        String value or default
    """
    if pd.isna(value) or value is None or value == '':
        return default
    try:
        result = str(value).strip()
        return result if result else default
    except (ValueError, TypeError):
        return default


def _safe_bool(value: Any, default: bool = False) -> bool:
    """
    Safely convert value to boolean.
    
    Args:
        value: Value to convert
        default: Default value if conversion fails
    
    Returns:
        Boolean value or default
    """
    if pd.isna(value) or value is None or value == '':
        return default
    try:
        # Handle various boolean representations
        if isinstance(value, bool):
            return value
        if isinstance(value, (int, float)):
            return bool(value)
        if isinstance(value, str):
            lower_val = value.lower().strip()
            if lower_val in ('true', '1', 'yes', 'y'):
                return True
            if lower_val in ('false', '0', 'no', 'n'):
                return False
        return default
    except (ValueError, TypeError):
        return default


def _fetch_shot_chart_from_api(
    player_id: int,
    game_id: Optional[str] = None,
    season: Optional[str] = None,
    season_type: str = "Regular Season",
) -> Optional[pd.DataFrame]:
    """
    Fetch shot chart data for a specific player from NBA API.
    
    Args:
        player_id: NBA player ID
        game_id: Optional NBA game ID (e.g., '0022500009'). If provided, fetches shots for that game only.
        season: Optional NBA season in format 'YYYY-YY' (e.g., '2024-25'). If None, uses current season.
        season_type: Season type ('Regular Season', 'Playoffs', 'Pre Season', 'All Star')
    
    Returns:
        DataFrame containing shot chart data, or None if fetch failed
    """
    if season is None:
        season = get_current_nba_season()
    
    print(f"Fetching shot chart for player {player_id} from NBA API...")
    if game_id:
        print(f"  Game ID: {game_id}")
    print(f"  Season: {season}, Season Type: {season_type}")
    
    try:
        shot_chart = safe_call_nba_api(
            name=f"ShotChartDetail(player_id={player_id}, game_id={game_id}, season={season})",
            call_fn=lambda: shotchartdetail.ShotChartDetail(
                team_id=0,  # 0 means all teams (required parameter)
                player_id=player_id,
                game_id_nullable=game_id if game_id else '',
                season_nullable=season,
                season_type_all_star=season_type,
                context_measure_simple='FGA',  # Field Goal Attempts
            ),
            max_retries=30,
            base_delay=3.0,
        )
        
        if shot_chart is None:
            print(f"[shot_service] Failed to fetch shot chart for player {player_id} after retries.")
            return None
        
        # ShotChartDetail returns DataFrames
        df = shot_chart.get_data_frames()[0]
        
        if df.empty:
            print(f"[shot_service] No shot chart data found for player {player_id}")
            if game_id:
                print(f"  This might mean the game hasn't started yet or the game_id is invalid.")
            return None
        
        print(f"Fetched {len(df)} shots from NBA API for player {player_id}")
        return df
        
    except Exception as e:
        print(f"[shot_service] Error fetching shot chart: {e}")
        import traceback
        traceback.print_exc()
        return None


def _transform_shot_data(
    row: pd.Series,
    player_id: int,
    game_id: str,
    season: str,
    valid_player_ids: set,
) -> Optional[Dict]:
    """
    Transform NBA API shot chart row to Supabase player_shots format.
    
    Args:
        row: DataFrame row from ShotChartDetail
        player_id: Player ID (for validation)
        game_id: Game ID
        season: Season string
        valid_player_ids: Set of valid player IDs from players table
    
    Returns:
        Transformed shot dictionary, or None if transformation failed
    """
    # Validate player_id
    if player_id not in valid_player_ids:
        return None  # Skip players not in players table
    
    # Extract required fields
    game_event_id = _safe_int(row.get('GAME_EVENT_ID', 0))
    if game_event_id == 0:
        return None  # Skip shots without valid game_event_id
    
    # Extract location data
    loc_x = _safe_int(row.get('LOC_X', 0))
    loc_y = _safe_int(row.get('LOC_Y', 0))
    
    # Extract shot made flag
    shot_made_flag = _safe_bool(row.get('SHOT_MADE_FLAG', 0))
    
    # Extract optional fields
    shot_distance = _safe_int(row.get('SHOT_DISTANCE', 0))
    shot_type_raw = _safe_str(row.get('SHOT_TYPE', ''))
    # Map shot_type to shorter values to fit varchar(10) constraint
    # "2PT Field Goal" -> "2PT", "3PT Field Goal" -> "3PT"
    shot_type = None
    if shot_type_raw:
        if '2PT' in shot_type_raw.upper() or '2-PT' in shot_type_raw.upper():
            shot_type = '2PT'
        elif '3PT' in shot_type_raw.upper() or '3-PT' in shot_type_raw.upper():
            shot_type = '3PT'
        else:
            # Fallback: truncate to 10 characters if mapping fails
            shot_type = shot_type_raw[:10] if len(shot_type_raw) > 10 else shot_type_raw
    
    shot_zone_basic = _safe_str(row.get('SHOT_ZONE_BASIC', ''))
    shot_zone_area = _safe_str(row.get('SHOT_ZONE_AREA', ''))
    
    # Extract game date if available
    game_date = None
    game_date_str = row.get('GAME_DATE', '')
    if game_date_str and pd.notna(game_date_str):
        try:
            # Game date format from NBA API is typically 'YYYY-MM-DD'
            from datetime import datetime
            game_date = datetime.strptime(str(game_date_str).strip(), '%Y-%m-%d').date()
        except (ValueError, TypeError):
            # Try alternative formats if needed
            pass
    
    # Build shot data
    shot_data = {
        'player_id': player_id,
        'game_id': str(game_id),
        'game_event_id': game_event_id,
        'season': season,
        'game_date': game_date.isoformat() if game_date else None,
        'loc_x': loc_x,
        'loc_y': loc_y,
        'shot_made_flag': shot_made_flag,
        'shot_distance': shot_distance if shot_distance > 0 else None,
        'shot_type': shot_type if shot_type else None,
        'shot_zone_basic': shot_zone_basic if shot_zone_basic else None,
        'shot_zone_area': shot_zone_area if shot_zone_area else None,
    }
    
    return shot_data


def sync_player_shots(
    player_id: int,
    game_id: Optional[str] = None,
    season: Optional[str] = None,
    season_type: str = "Regular Season",
) -> None:
    """
    Sync shot chart data for a specific player to Supabase player_shots table.
    
    Args:
        player_id: NBA player ID
        game_id: Optional NBA game ID. If provided, syncs shots for that game only.
                 If None, syncs all shots for the player in the specified season.
        season: Optional NBA season in format 'YYYY-YY' (e.g., '2024-25').
                If None, uses current NBA season automatically.
        season_type: Season type ('Regular Season', 'Playoffs', 'Pre Season', 'All Star')
    
    Extracts and syncs:
    - player_id, game_id, game_event_id, season, game_date, loc_x, loc_y,
      shot_made_flag, shot_distance, shot_type, shot_zone_basic, shot_zone_area
    """
    try:
        if season is None:
            season = get_current_nba_season()
        
        print(f"Starting shot chart sync for player {player_id}...")
        if game_id:
            print(f"  Game ID: {game_id}")
        print(f"  Season: {season}, Season Type: {season_type}")
        
        # Get Supabase client
        supabase = get_db()
        
        # Fetch shot chart data from API
        df = _fetch_shot_chart_from_api(player_id, game_id, season, season_type)
        if df is None:
            print(f"⚠️ Failed to fetch shot chart data for player {player_id}. Skipping.")
            return
        
        if len(df) == 0:
            print(f"ℹ️ No shot data found for player {player_id}")
            return
        
        # Get valid player IDs from database (for foreign key validation)
        print("Fetching valid player IDs from database...")
        players_result = supabase.table('players').select('id').execute()
        valid_player_ids = set(player['id'] for player in players_result.data)
        print(f"Found {len(valid_player_ids)} valid players in database")
        
        # Transform shot data
        print(f"Transforming {len(df)} shots...")
        shots_data = []
        skipped_count = 0
        
        for _, row in df.iterrows():
            # Extract game_id from row if not provided
            row_game_id = game_id
            if not row_game_id:
                row_game_id = _safe_str(row.get('GAME_ID', ''))
                if not row_game_id:
                    skipped_count += 1
                    continue
            
            transformed_shot = _transform_shot_data(
                row,
                player_id,
                row_game_id,
                season,
                valid_player_ids,
            )
            
            if transformed_shot:
                shots_data.append(transformed_shot)
            else:
                skipped_count += 1
        
        if skipped_count > 0:
            print(f"Skipped {skipped_count} shots (missing data or invalid player_id)")
        
        if len(shots_data) == 0:
            print(f"ℹ️ No valid shot data to sync for player {player_id}")
            return
        
        # Determine sync strategy based on whether game_id is provided
        if game_id:
            # For a specific game: delete existing shots for this player+game, then insert
            print(f"Syncing {len(shots_data)} shots to Supabase (game-specific sync)...")
            print(f"Deleting existing shots for player {player_id}, game {game_id} (if any)...")
            
            try:
                delete_result = supabase.table('player_shots').delete().eq('player_id', player_id).eq('game_id', game_id).execute()
                deleted_count = len(delete_result.data) if delete_result.data else 0
                if deleted_count > 0:
                    print(f"  Deleted {deleted_count} existing shots for player {player_id}, game {game_id}")
            except Exception as delete_error:
                print(f"  ⚠️ Warning: Failed to delete existing shots: {delete_error}")
                print(f"  Continuing with insert anyway...")
        else:
            # For season-wide sync: use upsert based on unique constraint (game_id, game_event_id)
            print(f"Syncing {len(shots_data)} shots to Supabase (season-wide sync with upsert)...")
        
        # Insert/upsert shots
        synced_count = 0
        failed_count = 0
        
        try:
            if game_id:
                # For game-specific: use insert (we already deleted existing)
                result = supabase.table('player_shots').insert(shots_data).execute()
                synced_count = len(shots_data)
                print(f"✅ Successfully inserted {synced_count} shots")
            else:
                # For season-wide: use upsert with unique constraint
                # Note: Supabase upsert requires specifying the conflict columns
                # Since we have unique constraint on (game_id, game_event_id), we'll use individual upserts
                print("  Using individual upserts for season-wide sync...")
                for shot_data in shots_data:
                    try:
                        # Try to insert, if conflict then update
                        # Supabase doesn't have native upsert with multiple columns, so we use a workaround
                        # First try to delete existing, then insert
                        supabase.table('player_shots').delete().eq('game_id', shot_data['game_id']).eq('game_event_id', shot_data['game_event_id']).execute()
                        supabase.table('player_shots').insert(shot_data).execute()
                        synced_count += 1
                    except Exception as e:
                        failed_count += 1
                        if failed_count <= 3:
                            print(f"  ❌ Failed to upsert shot (game_id={shot_data['game_id']}, game_event_id={shot_data['game_event_id']}): {e}")
                
                if synced_count > 0:
                    print(f"✅ Upserted {synced_count}/{len(shots_data)} shots")
                else:
                    print(f"❌ Failed to upsert any shots for player {player_id}")
                    raise Exception("Failed to sync shots")
            
        except Exception as bulk_error:
            # If bulk insert fails, try one by one
            print(f"⚠️ Bulk operation failed, trying individual operations...")
            
            for shot_data in shots_data:
                try:
                    # Delete existing if any, then insert
                    supabase.table('player_shots').delete().eq('game_id', shot_data['game_id']).eq('game_event_id', shot_data['game_event_id']).execute()
                    supabase.table('player_shots').insert(shot_data).execute()
                    synced_count += 1
                except Exception as e:
                    failed_count += 1
                    if failed_count <= 3:
                        print(f"  ❌ Failed to insert shot (game_id={shot_data['game_id']}, game_event_id={shot_data['game_event_id']}): {e}")
            
            if synced_count > 0:
                print(f"✅ Inserted {synced_count}/{len(shots_data)} shots")
            else:
                print(f"❌ Failed to insert any shots for player {player_id}")
                raise Exception(f"Failed to sync shots: {bulk_error}")
        
        # Verify data insertion
        print("\nVerifying data insertion...")
        query = supabase.table('player_shots').select('player_id, game_id, game_event_id, shot_made_flag, loc_x, loc_y').eq('player_id', player_id)
        if game_id:
            query = query.eq('game_id', game_id)
        verify_result = query.limit(5).execute()
        
        if verify_result.data:
            print(f"✅ Verification successful! Found shots for player {player_id}")
            if game_id:
                print(f"  Game ID: {game_id}")
            print("Sample shots:")
            for shot in verify_result.data[:3]:
                made = "Made" if shot['shot_made_flag'] else "Missed"
                print(
                    f"  - Game {shot['game_id']}, Event {shot['game_event_id']}: "
                    f"{made} at ({shot['loc_x']}, {shot['loc_y']})"
                )
        else:
            print(f"⚠️ Warning: No shots found in database for player {player_id} after insertion")
        
        print(f"\n✅ Shot chart sync completed successfully for player {player_id}!")
        
    except Exception as e:
        print(f"\n❌ Error during shot chart sync for player {player_id}: {str(e)}")
        import traceback
        traceback.print_exc()
        raise
