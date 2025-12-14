"""
Player season statistics synchronization service.
Fetches player season averages from NBA API and syncs to Supabase player_season_stats table.
"""
import pandas as pd
from nba_api.stats.endpoints import leaguedashplayerstats
from db import get_db
from utils import get_current_nba_season


def sync_player_season_stats(season=None):
    """
    Sync player season statistics from NBA API to Supabase player_season_stats table.
    
    Fetches league-wide player stats and extracts:
    - player_id, team_id, season, gp, min, pts, reb, ast, stl, blk, tov,
      fg_pct, fg3_pct, ft_pct, fantasy_avg
    
    Args:
        season: NBA season in format 'YYYY-YY' (e.g., '2024-25').
                If None, uses current NBA season automatically.
    """
    try:
        # Use current season if not specified
        if season is None:
            season = get_current_nba_season()
        
        print("Starting player season stats sync...")
        print(f"Season: {season}")
        
        # Step 1: Fetch data from NBA API
        print("Fetching league-wide stats...")
        stats = leaguedashplayerstats.LeagueDashPlayerStats(
            season=season,
            per_mode_detailed='PerGame'  # Important: We want averages, not totals
        )
        df = stats.get_data_frames()[0]
        
        if df.empty:
            print("Warning: No data received from NBA API")
            return
        
        print(f"Fetched stats for {len(df)} players from NBA API")
        
        # Get Supabase client
        supabase = get_db()
        
        # Get list of valid player IDs from players table (to avoid foreign key violations)
        print("Fetching valid player IDs from players table...")
        players_result = supabase.table('players').select('id').execute()
        valid_player_ids = set(player['id'] for player in players_result.data)
        print(f"Found {len(valid_player_ids)} valid players in database")
        
        # Step 2: Transform & Calculate
        print("Transforming and calculating stats...")
        stats_data = []
        skipped_count = 0
        
        for _, row in df.iterrows():
            player_id = int(row.get('PLAYER_ID', 0))
            if player_id == 0:
                continue
            
            # Skip players not in players table (foreign key constraint)
            if player_id not in valid_player_ids:
                skipped_count += 1
                continue
            
            team_id = int(row.get('TEAM_ID', 0)) if pd.notna(row.get('TEAM_ID')) else None
            
            # Map basic stats
            gp = int(row.get('GP', 0)) if pd.notna(row.get('GP')) else 0
            
            # Map float stats (handle None/NaN values)
            def safe_float(value, default=0.0):
                if pd.isna(value) or value is None:
                    return default
                try:
                    return float(value)
                except (ValueError, TypeError):
                    return default
            
            min_val = safe_float(row.get('MIN'))
            pts = safe_float(row.get('PTS'))
            reb = safe_float(row.get('REB'))
            ast = safe_float(row.get('AST'))
            stl = safe_float(row.get('STL'))
            blk = safe_float(row.get('BLK'))
            tov = safe_float(row.get('TOV'))
            fg_pct = safe_float(row.get('FG_PCT'))
            fg3_pct = safe_float(row.get('FG3_PCT'))
            ft_pct = safe_float(row.get('FT_PCT'))
            
            # Calculate fantasy_avg
            # Formula: (PTS * 1.0) + (REB * 1.2) + (AST * 1.5) + (STL * 3.0) + (BLK * 3.0) - (TOV * 1.0)
            fantasy_avg = round(
                (pts * 1.0) + (reb * 1.2) + (ast * 1.5) + (stl * 3.0) + (blk * 3.0) - (tov * 1.0),
                1
            )
            
            stat_record = {
                'player_id': player_id,
                'team_id': team_id,
                'season': season,
                'gp': gp,
                'min': min_val,
                'pts': pts,
                'reb': reb,
                'ast': ast,
                'stl': stl,
                'blk': blk,
                'tov': tov,
                'fg_pct': fg_pct,
                'fg3_pct': fg3_pct,
                'ft_pct': ft_pct,
                'fantasy_avg': fantasy_avg
            }
            
            stats_data.append(stat_record)
        
        if skipped_count > 0:
            print(f"Skipped {skipped_count} players not found in players table")
        
        # Step 3: Load to Supabase (Bulk Upsert)
        if stats_data:
            print(f"Syncing {len(stats_data)} player stats to Supabase...")
            
            try:
                # Bulk upsert
                result = supabase.table('player_season_stats').upsert(
                    stats_data,
                    on_conflict='player_id,season'
                ).execute()
                
                print(f"✅ Successfully synced stats for {len(stats_data)} players")
                
            except Exception as upsert_error:
                # If bulk upsert fails, try one by one
                print(f"⚠️ Bulk upsert failed, trying individual upserts...")
                synced_count = 0
                failed_count = 0
                
                for stat in stats_data:
                    try:
                        supabase.table('player_season_stats').upsert(
                            stat,
                            on_conflict='player_id,season'
                        ).execute()
                        synced_count += 1
                    except Exception as e:
                        failed_count += 1
                        if failed_count <= 3:
                            print(f"  ❌ Failed to upsert stats for player {stat['player_id']}: {e}")
                
                if synced_count > 0:
                    print(f"✅ Successfully synced stats for {synced_count}/{len(stats_data)} players")
                else:
                    raise Exception(f"Failed to sync any player stats: {upsert_error}")
        
        # Verify data insertion
        print("\nVerifying data insertion...")
        verify_result = supabase.table('player_season_stats').select(
            'player_id, season, pts, reb, ast, fantasy_avg'
        ).eq('season', season).limit(5).execute()
        
        if verify_result.data:
            print(f"✅ Verification successful! Found stats for season {season}")
            print("Sample stats:")
            for stat in verify_result.data[:3]:
                print(f"  - Player {stat['player_id']}: {stat['pts']} PTS, {stat['reb']} REB, {stat['ast']} AST, Fantasy: {stat['fantasy_avg']}")
        else:
            print("⚠️ Warning: No stats found in database after insertion")
        
        print("\n✅ Player season stats sync completed successfully!")
        
    except Exception as e:
        print(f"\n❌ Error during player season stats sync: {str(e)}")
        import traceback
        traceback.print_exc()
        raise

