"""
Player season advanced statistics synchronization service.
Fetches player advanced stats from NBA API and syncs to Supabase player_season_advanced_stats table.
"""
from typing import Dict, Optional, Set
import pandas as pd
from nba_api.stats.endpoints import leaguedashplayerstats
from db import get_db
from utils import get_current_nba_season, safe_call_nba_api


def _safe_int(value, default: int = 0) -> int:
    """Safely convert value to int."""
    if pd.isna(value) or value is None or value == '':
        return default
    try:
        return int(float(value))
    except (ValueError, TypeError):
        return default


def _safe_float(value, default: float = 0.0) -> Optional[float]:
    """Safely convert value to float, returning None for invalid values."""
    if pd.isna(value) or value is None or value == '':
        return None
    try:
        return float(value)
    except (ValueError, TypeError):
        return None


def _transform_advanced_stats(
    row: pd.Series,
    season: str,
    valid_player_ids: Set[int],
    valid_team_ids: Set[int]
) -> Optional[Dict]:
    """
    Transform NBA API advanced stats row to Supabase player_season_advanced_stats format.
    
    Args:
        row: DataFrame row from LeagueDashPlayerStats (Advanced measure type)
        season: NBA season string (e.g., '2024-25')
        valid_player_ids: Set of valid player IDs from database
        valid_team_ids: Set of valid team IDs from database
    
    Returns:
        Dict with transformed stats, or None if player should be skipped
    """
    player_id = _safe_int(row.get('PLAYER_ID', 0))
    if player_id == 0:
        return None
    
    # Skip players not in players table (foreign key constraint)
    if player_id not in valid_player_ids:
        return None
    
    team_id = _safe_int(row.get('TEAM_ID', 0))
    # Set team_id to None if not in valid teams (FK constraint)
    if team_id not in valid_team_ids:
        team_id = None
    
    # Map fields from NBA API to database columns
    stats_data = {
        'player_id': player_id,
        'team_id': team_id,
        'season': season,
        'gp': _safe_int(row.get('GP', 0)),
        'min': _safe_float(row.get('MIN')),
        'off_rating': _safe_float(row.get('OFF_RATING')),
        'def_rating': _safe_float(row.get('DEF_RATING')),
        'net_rating': _safe_float(row.get('NET_RATING')),
        'ts_pct': _safe_float(row.get('TS_PCT')),
        'efg_pct': _safe_float(row.get('EFG_PCT')),
        'ast_pct': _safe_float(row.get('AST_PCT')),
        'ast_to': _safe_float(row.get('AST_TO')),
        'ast_ratio': _safe_float(row.get('AST_RATIO')),
        'tm_tov_pct': _safe_float(row.get('TM_TOV_PCT')),
        'oreb_pct': _safe_float(row.get('OREB_PCT')),
        'dreb_pct': _safe_float(row.get('DREB_PCT')),
        'reb_pct': _safe_float(row.get('REB_PCT')),
        'usg_pct': _safe_float(row.get('USG_PCT')),
        'pace': _safe_float(row.get('PACE')),
        'pie': _safe_float(row.get('PIE')),
        'poss': _safe_int(row.get('POSS', 0)) or None,
    }
    
    return stats_data


def sync_player_season_advanced_stats(season: Optional[str] = None) -> None:
    """
    Sync player season advanced statistics from NBA API to Supabase player_season_advanced_stats table.
    
    Fetches league-wide player advanced stats and extracts:
    - player_id, team_id, season, gp, min
    - off_rating, def_rating, net_rating
    - ts_pct, efg_pct, ast_pct, ast_to, ast_ratio
    - tm_tov_pct, oreb_pct, dreb_pct, reb_pct
    - usg_pct, pace, pie, poss
    
    Args:
        season: NBA season in format 'YYYY-YY' (e.g., '2024-25').
                If None, uses current NBA season automatically.
    """
    try:
        # Use current season if not specified
        if season is None:
            season = get_current_nba_season()
        
        print("Starting player season advanced stats sync...")
        print(f"Season: {season}")
        
        # Step 1: Fetch data from NBA API (Advanced measure type)
        print("Fetching league-wide advanced stats (LeagueDashPlayerStats - Advanced)...")
        stats = safe_call_nba_api(
            name=f"LeagueDashPlayerStats(season={season}, measure_type=Advanced)",
            call_fn=lambda: leaguedashplayerstats.LeagueDashPlayerStats(
                season=season,
                per_mode_detailed='PerGame',
                measure_type_detailed_defense='Advanced',  # Key: Advanced stats
            ),
            max_retries=30,
            base_delay=3.0,
        )
        
        if stats is None:
            print(
                "[advanced_stats_service] Failed to fetch LeagueDashPlayerStats (Advanced) after retries. "
                "Skipping player season advanced stats sync for this run."
            )
            return
        
        df = stats.get_data_frames()[0]
        
        if df.empty:
            print("⚠️ Warning: No data received from NBA API")
            return
        
        print(f"Fetched advanced stats for {len(df)} players from NBA API")
        
        # Get Supabase client
        supabase = get_db()
        
        # Get list of valid player IDs from players table (to avoid foreign key violations)
        print("Fetching valid player IDs from players table...")
        players_result = supabase.table('players').select('id').execute()
        valid_player_ids = set(player['id'] for player in players_result.data)
        print(f"Found {len(valid_player_ids)} valid players in database")
        
        # Get list of valid team IDs from teams table (for FK validation)
        print("Fetching valid team IDs from teams table...")
        teams_result = supabase.table('teams').select('id').execute()
        valid_team_ids = set(team['id'] for team in teams_result.data)
        print(f"Found {len(valid_team_ids)} valid teams in database")
        
        # Step 2: Transform data
        print("Transforming advanced stats data...")
        stats_data = []
        skipped_count = 0
        
        for _, row in df.iterrows():
            transformed = _transform_advanced_stats(row, season, valid_player_ids, valid_team_ids)
            if transformed:
                stats_data.append(transformed)
            else:
                skipped_count += 1
        
        if skipped_count > 0:
            print(f"Skipped {skipped_count} players (not found in players table or invalid data)")
        
        print(f"Transformed {len(stats_data)} player advanced stats records")
        
        # Step 3: Load to Supabase (Bulk Upsert)
        if stats_data:
            print(f"Syncing {len(stats_data)} player advanced stats to Supabase...")
            
            synced_count = 0
            failed_count = 0
            
            try:
                # Bulk upsert with composite key (player_id, season, team_id)
                result = supabase.table('player_season_advanced_stats').upsert(
                    stats_data,
                    on_conflict='player_id,season,team_id'
                ).execute()
                
                synced_count = len(stats_data)
                print(f"✅ Successfully synced advanced stats for {synced_count} players")
                
            except Exception as upsert_error:
                # If bulk upsert fails, try one by one
                print(f"⚠️ Bulk upsert failed ({upsert_error}), trying individual upserts...")
                
                for stat in stats_data:
                    try:
                        supabase.table('player_season_advanced_stats').upsert(
                            stat,
                            on_conflict='player_id,season,team_id'
                        ).execute()
                        synced_count += 1
                    except Exception as e:
                        failed_count += 1
                        if failed_count <= 3:
                            print(f"  ❌ Failed to upsert stats for player {stat['player_id']}: {e}")
                
                if synced_count > 0:
                    print(f"✅ Successfully synced advanced stats for {synced_count}/{len(stats_data)} players")
                else:
                    raise Exception(f"Failed to sync any player advanced stats: {upsert_error}")
            
            if failed_count > 0:
                print(f"⚠️ Failed to sync {failed_count} player records")
        else:
            print("ℹ️ No valid player advanced stats to sync")
        
        # Step 4: Verify data insertion
        print("\nVerifying data insertion...")
        verify_result = supabase.table('player_season_advanced_stats').select(
            'player_id, season, off_rating, def_rating, net_rating, ts_pct, usg_pct'
        ).eq('season', season).order('net_rating', desc=True).limit(5).execute()
        
        if verify_result.data:
            print(f"✅ Verification successful! Found advanced stats for season {season}")
            print("Top 5 players by Net Rating:")
            for stat in verify_result.data:
                print(
                    f"  - Player {stat['player_id']}: "
                    f"OFF {stat['off_rating']:.1f}, DEF {stat['def_rating']:.1f}, "
                    f"NET {stat['net_rating']:.1f}, TS% {stat['ts_pct']:.3f}, USG% {stat['usg_pct']:.3f}"
                )
        else:
            print("⚠️ Warning: No advanced stats found in database after insertion")
        
        print("\n✅ Player season advanced stats sync completed successfully!")
        
    except Exception as e:
        print(f"\n❌ Error during player season advanced stats sync: {str(e)}")
        import traceback
        traceback.print_exc()
        raise
