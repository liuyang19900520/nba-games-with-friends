"""
Team season advanced statistics synchronization service.
Fetches team advanced stats from NBA API and syncs to Supabase team_season_advanced_stats table.

Table Schema:
- team_id, season (unique constraint)
- gp, w, l (games played, wins, losses)
- off_rating, def_rating, net_rating (team efficiency ratings)
- pace, pie (pace and player impact estimate)
- ts_pct, efg_pct, ast_to (shooting efficiency and assist-turnover ratio)
"""
from typing import Dict, Optional, Set
import pandas as pd
from nba_api.stats.endpoints import leaguedashteamstats
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


def _transform_team_advanced_stats(
    row: pd.Series,
    season: str,
    valid_team_ids: Set[int]
) -> Optional[Dict]:
    """
    Transform NBA API team advanced stats row to Supabase team_season_advanced_stats format.
    
    Args:
        row: DataFrame row from LeagueDashTeamStats (Advanced measure type)
        season: NBA season string (e.g., '2024-25')
        valid_team_ids: Set of valid team IDs from database
    
    Returns:
        Dict with transformed stats, or None if team should be skipped
    """
    team_id = _safe_int(row.get('TEAM_ID', 0))
    if team_id == 0:
        return None
    
    # Skip teams not in teams table (foreign key constraint)
    if team_id not in valid_team_ids:
        return None
    
    # Map fields from NBA API to database columns (matching actual table schema)
    stats_data = {
        'team_id': team_id,
        'season': season,
        'gp': _safe_int(row.get('GP', 0)),
        'w': _safe_int(row.get('W', 0)),
        'l': _safe_int(row.get('L', 0)),
        'off_rating': _safe_float(row.get('OFF_RATING')),
        'def_rating': _safe_float(row.get('DEF_RATING')),
        'net_rating': _safe_float(row.get('NET_RATING')),
        'pace': _safe_float(row.get('PACE')),
        'pie': _safe_float(row.get('PIE')),
        'ts_pct': _safe_float(row.get('TS_PCT')),
        'efg_pct': _safe_float(row.get('EFG_PCT')),
        'ast_to': _safe_float(row.get('AST_TO')),
    }
    
    return stats_data


def sync_team_season_advanced_stats(season: Optional[str] = None) -> None:
    """
    Sync team season advanced statistics from NBA API to Supabase team_season_advanced_stats table.
    
    Fetches league-wide team advanced stats (LeagueDashTeamStats - Advanced) and extracts:
    - team_id, season, gp, w, l
    - off_rating, def_rating, net_rating (team efficiency ratings)
    - pace, pie
    - ts_pct, efg_pct, ast_to (shooting efficiency)
    
    Args:
        season: NBA season in format 'YYYY-YY' (e.g., '2024-25').
                If None, uses current NBA season automatically.
    """
    try:
        # Use current season if not specified
        if season is None:
            season = get_current_nba_season()
        
        print("Starting team season advanced stats sync...")
        print(f"Season: {season}")
        
        # Step 1: Fetch data from NBA API (Advanced measure type)
        print("Fetching league-wide team advanced stats (LeagueDashTeamStats - Advanced)...")
        stats = safe_call_nba_api(
            name=f"LeagueDashTeamStats(season={season}, measure_type=Advanced)",
            call_fn=lambda: leaguedashteamstats.LeagueDashTeamStats(
                season=season,
                per_mode_detailed='PerGame',
                measure_type_detailed_defense='Advanced',  # Key: Advanced stats
            ),
            max_retries=30,
            base_delay=3.0,
        )
        
        if stats is None:
            print(
                "[team_advanced_stats_service] Failed to fetch LeagueDashTeamStats (Advanced) after retries. "
                "Skipping team season advanced stats sync for this run."
            )
            return
        
        df = stats.get_data_frames()[0]
        
        if df.empty:
            print("⚠️ Warning: No data received from NBA API")
            return
        
        print(f"Fetched advanced stats for {len(df)} teams from NBA API")
        
        # Get Supabase client
        supabase = get_db()
        
        # Get list of valid team IDs from teams table (for FK validation)
        print("Fetching valid team IDs from teams table...")
        teams_result = supabase.table('teams').select('id').execute()
        valid_team_ids = set(team['id'] for team in teams_result.data)
        print(f"Found {len(valid_team_ids)} valid teams in database")
        
        # Step 2: Transform data
        print("Transforming team advanced stats data...")
        stats_data = []
        skipped_count = 0
        
        for _, row in df.iterrows():
            transformed = _transform_team_advanced_stats(row, season, valid_team_ids)
            if transformed:
                stats_data.append(transformed)
            else:
                skipped_count += 1
        
        if skipped_count > 0:
            print(f"Skipped {skipped_count} teams (not found in teams table or invalid data)")
        
        print(f"Transformed {len(stats_data)} team advanced stats records")
        
        # Step 3: Load to Supabase (Bulk Upsert)
        if stats_data:
            print(f"Syncing {len(stats_data)} team advanced stats to Supabase...")
            
            synced_count = 0
            failed_count = 0
            
            try:
                # Bulk upsert with composite key (team_id, season)
                result = supabase.table('team_season_advanced_stats').upsert(
                    stats_data,
                    on_conflict='team_id,season'
                ).execute()
                
                synced_count = len(stats_data)
                print(f"✅ Successfully synced advanced stats for {synced_count} teams")
                
            except Exception as upsert_error:
                # If bulk upsert fails, try one by one
                print(f"⚠️ Bulk upsert failed ({upsert_error}), trying individual upserts...")
                
                for stat in stats_data:
                    try:
                        supabase.table('team_season_advanced_stats').upsert(
                            stat,
                            on_conflict='team_id,season'
                        ).execute()
                        synced_count += 1
                    except Exception as e:
                        failed_count += 1
                        if failed_count <= 3:
                            print(f"  ❌ Failed to upsert stats for team {stat['team_id']}: {e}")
                
                if synced_count > 0:
                    print(f"✅ Successfully synced advanced stats for {synced_count}/{len(stats_data)} teams")
                else:
                    raise Exception(f"Failed to sync any team advanced stats: {upsert_error}")
            
            if failed_count > 0:
                print(f"⚠️ Failed to sync {failed_count} team records")
        else:
            print("ℹ️ No valid team advanced stats to sync")
        
        # Step 4: Verify data insertion
        print("\nVerifying data insertion...")
        verify_result = supabase.table('team_season_advanced_stats').select(
            'team_id, season, gp, w, l, off_rating, def_rating, net_rating, pace, pie'
        ).eq('season', season).order('net_rating', desc=True).limit(5).execute()
        
        if verify_result.data:
            print(f"✅ Verification successful! Found advanced stats for season {season}")
            print("Top 5 teams by Net Rating:")
            for stat in verify_result.data:
                gp = stat['gp'] or 0
                w = stat['w'] or 0
                l = stat['l'] or 0
                off = stat['off_rating'] or 0
                defr = stat['def_rating'] or 0
                net = stat['net_rating'] or 0
                pace = stat['pace'] or 0
                print(
                    f"  - Team {stat['team_id']}: "
                    f"{w}-{l} ({gp}GP), "
                    f"OFF {off:.1f}, DEF {defr:.1f}, NET {net:.1f}, PACE {pace:.1f}"
                )
        else:
            print("⚠️ Warning: No team advanced stats found in database after insertion")
        
        print("\n✅ Team season advanced stats sync completed successfully!")
        
    except Exception as e:
        print(f"\n❌ Error during team season advanced stats sync: {str(e)}")
        import traceback
        traceback.print_exc()
        raise
