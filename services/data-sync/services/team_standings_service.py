"""
Team standings synchronization service.
Fetches team standings data from NBA API and syncs to Supabase team_standings table.
"""
from typing import Optional
import pandas as pd
from nba_api.stats.endpoints import leaguestandings
from db import get_db
from utils import get_current_nba_season, safe_call_nba_api


def sync_team_standings(season: Optional[str] = None) -> None:
    """
    Sync team standings from NBA API to Supabase team_standings table.
    
    Fetches current season standings and extracts dynamic info:
    - team_id, season, wins, losses, win_pct, conf_rank, 
      home_record, road_record, streak
    
    Args:
        season: NBA season in format 'YYYY-YY' (e.g., '2024-25'). 
                If None, uses current NBA season automatically.
    """
    try:
        # Use current season if not specified
        if season is None:
            season = get_current_nba_season()
        
        print("Starting team standings sync...")
        print(f"Season: {season}")
        
        # Fetch data from NBA API
        print("Fetching data from NBA API (LeagueStandings)...")
        standings = safe_call_nba_api(
            name=f"LeagueStandings(season={season})",
            call_fn=lambda: leaguestandings.LeagueStandings(season=season),
            max_retries=3,
            base_delay=3.0,
        )
        if standings is None:
            print("[team_standings_service] Failed to fetch LeagueStandings after retries. "
                  "Skipping team standings sync for this run.")
            return
        df = standings.get_data_frames()[0]
        
        if df.empty:
            print("Warning: No data received from NBA API")
            return
        
        print(f"Fetched {len(df)} team standings from NBA API")
        
        # Get Supabase client
        supabase = get_db()
        
        # Transform data
        print("Transforming standings data...")
        standings_data = []
        
        for _, row in df.iterrows():
            team_id = int(row.get('TeamID', row.get('TEAM_ID', 0)))
            if team_id == 0:
                continue
            
            # Map wins (case-insensitive)
            wins = 0
            for wins_col in ['WINS', 'Wins', 'Win', 'WIN']:
                if wins_col in row and pd.notna(row.get(wins_col)):
                    wins = int(row.get(wins_col))
                    break
            
            # Map losses (case-insensitive)
            losses = 0
            for losses_col in ['LOSSES', 'Losses', 'Loss', 'LOSS']:
                if losses_col in row and pd.notna(row.get(losses_col)):
                    losses = int(row.get(losses_col))
                    break
            
            # Map win_pct (from WinPCT)
            win_pct = None
            for pct_col in ['WinPCT', 'WIN_PCT', 'WinPct', 'win_pct']:
                if pct_col in row and pd.notna(row.get(pct_col)):
                    try:
                        win_pct = float(row.get(pct_col))
                        break
                    except (ValueError, TypeError):
                        continue
            
            # Map conf_rank (from PlayoffRank, which represents conference rank)
            conf_rank = None
            for rank_col in ['PlayoffRank', 'ConferenceRank', 'CONF_RANK', 'ConfRank', 'Conference_Rank']:
                if rank_col in row and pd.notna(row.get(rank_col)):
                    try:
                        conf_rank = int(row.get(rank_col))
                        break
                    except (ValueError, TypeError):
                        continue
            
            # Map home_record (from HOME)
            home_record = None
            for home_col in ['HOME', 'HOME_RECORD', 'HomeRecord', 'home']:
                if home_col in row and pd.notna(row.get(home_col)):
                    home_record = str(row.get(home_col)).strip()
                    if home_record:
                        break
            
            # Map road_record (from ROAD)
            road_record = None
            for road_col in ['ROAD', 'ROAD_RECORD', 'RoadRecord', 'road']:
                if road_col in row and pd.notna(row.get(road_col)):
                    road_record = str(row.get(road_col)).strip()
                    if road_record:
                        break
            
            # Map streak (from strCurrentStreak or CurrentStreak)
            streak = None
            for streak_col in ['strCurrentStreak', 'CurrentStreak', 'STREAK', 'Streak', 'current_streak']:
                if streak_col in row and pd.notna(row.get(streak_col)):
                    streak_value = row.get(streak_col)
                    # If it's a string, use it directly; if it's numeric, convert to string
                    if isinstance(streak_value, str):
                        streak = streak_value.strip()
                    else:
                        streak = str(streak_value).strip()
                    if streak:
                        break
            
            standing = {
                'team_id': team_id,
                'season': season,
                'wins': wins,
                'losses': losses,
                'win_pct': win_pct,
                'conf_rank': conf_rank,
                'home_record': home_record,
                'road_record': road_record,
                'streak': streak
            }
            
            standings_data.append(standing)
        
        # Bulk upsert to Supabase (optimized)
        if standings_data:
            print(f"Syncing {len(standings_data)} team standings to Supabase...")
            print(f"Sample standing data: {standings_data[0] if standings_data else 'None'}")
            
            try:
                # Use bulk upsert for better performance
                result = supabase.table('team_standings').upsert(
                    standings_data,
                    on_conflict='team_id,season'
                ).execute()
                
                print(f"✅ Successfully synced {len(standings_data)} team standings")
                
            except Exception as upsert_error:
                print(f"❌ Bulk upsert failed: {upsert_error}")
                print("This is likely due to Row Level Security (RLS) policy or missing columns.")
                print("\nTo fix this, you need to:")
                print("1. Ensure SUPABASE_SERVICE_ROLE_KEY is correctly set in .env")
                print("2. Ensure all required columns exist in team_standings table")
                print("3. OR adjust RLS policies in Supabase for team_standings table")
                raise Exception(f"Failed to upsert team standings: {upsert_error}")
        
        # Verify data insertion
        print("\nVerifying data insertion...")
        verify_result = supabase.table('team_standings').select(
            'team_id, season, wins, losses, win_pct, conf_rank, home_record, road_record, streak'
        ).eq('season', season).limit(5).execute()
        
        if verify_result.data:
            print(f"✅ Verification successful! Found {len(verify_result.data)} standings for season {season}")
            print("Sample standings:")
            for standing in verify_result.data[:3]:
                print(f"  - Team {standing['team_id']} ({standing['season']}): "
                      f"{standing['wins']}W-{standing['losses']}L, "
                      f"Win%: {standing.get('win_pct', 'N/A')}, "
                      f"Conf Rank: {standing.get('conf_rank', 'N/A')}, "
                      f"Home: {standing.get('home_record', 'N/A')}, "
                      f"Road: {standing.get('road_record', 'N/A')}, "
                      f"Streak: {standing.get('streak', 'N/A')}")
        else:
            print("⚠️ Warning: No standings found in database after insertion")
        
        print("\n✅ Team standings sync completed successfully!")
        
    except Exception as e:
        print(f"\n❌ Error during team standings sync: {str(e)}")
        import traceback
        traceback.print_exc()
        raise
