"""
Player synchronization service.
Fetches player data from NBA API and syncs to Supabase players table.
"""
import pandas as pd
import time
from nba_api.stats.endpoints import commonteamroster
from db import get_db
from utils import get_current_nba_season, safe_call_nba_api


def sync_active_players() -> None:
    """
    Sync active players from NBA API to Supabase players table.
    
    Fetches roster for each team and extracts player info:
    - id, team_id, first_name, last_name, full_name, jersey_num, 
      position, height, weight, headshot_url, is_active
    """
    try:
        print("Starting player sync...")
        
        # Get current NBA season
        season = get_current_nba_season()
        print(f"Current NBA season: {season}")
        
        # Get Supabase client
        supabase = get_db()
        
        # Step 1: Get all team IDs from Supabase teams table
        print("Fetching team IDs from Supabase...")
        teams_result = supabase.table('teams').select('id').execute()
        
        if not teams_result.data:
            print("⚠️ Warning: No teams found in database. Please sync teams first.")
            return
        
        team_ids = [team['id'] for team in teams_result.data]
        print(f"Found {len(team_ids)} teams to process")
        
        total_players_synced = 0
        total_players_failed = 0
        
        # Step 2: Fetch roster for each team
        for idx, team_id in enumerate(team_ids, 1):
            print(f"\n[{idx}/{len(team_ids)}] Syncing roster for Team {team_id}...")
            
            try:
                # Fetch roster from NBA API with retries and throttling
                roster = safe_call_nba_api(
                    name=f"CommonTeamRoster(team_id={team_id}, season={season})",
                    call_fn=lambda team_id=team_id: commonteamroster.CommonTeamRoster(
                        team_id=team_id, season=season
                    ),
                    max_retries=3,
                    base_delay=3.0,
                    post_success_sleep=0.6,  # retain existing rate limiting behaviour
                )
                if roster is None:
                    print(
                        f"  ❌ Failed to fetch roster for team {team_id} after retries. "
                        "Skipping this team."
                    )
                    continue

                df = roster.get_data_frames()[0]
                
                if df.empty:
                    print(f"  ⚠️ No players found for team {team_id}")
                    continue
                
                print(f"  Fetched {len(df)} players from NBA API")
                
                # Step 3: Transform data
                players_data = []
                
                for _, row in df.iterrows():
                    player_id = int(row.get('PLAYER_ID', 0))
                    if player_id == 0:
                        continue
                    
                    # Get full name and try to split into first/last name
                    full_name = str(row.get('PLAYER', '')).strip()
                    first_name = None
                    last_name = None
                    
                    if full_name:
                        # Try to split name (usually "FirstName LastName")
                        name_parts = full_name.split(maxsplit=1)
                        if len(name_parts) == 2:
                            first_name = name_parts[0].strip()
                            last_name = name_parts[1].strip()
                        elif len(name_parts) == 1:
                            # If only one part, use as last_name
                            last_name = name_parts[0].strip()
                    
                    # Map other fields
                    jersey_num = str(row.get('NUM', '')).strip() if pd.notna(row.get('NUM')) else None
                    position = str(row.get('POSITION', '')).strip() if pd.notna(row.get('POSITION')) else None
                    height = str(row.get('HEIGHT', '')).strip() if pd.notna(row.get('HEIGHT')) else None
                    weight = str(row.get('WEIGHT', '')).strip() if pd.notna(row.get('WEIGHT')) else None
                    
                    # Construct headshot URL
                    headshot_url = f"https://cdn.nba.com/headshots/nba/latest/1040x760/{player_id}.png"
                    
                    player_data = {
                        'id': player_id,
                        'team_id': team_id,
                        'first_name': first_name,
                        'last_name': last_name,
                        'full_name': full_name,
                        'jersey_num': jersey_num,
                        'position': position,
                        'height': height,
                        'weight': weight,
                        'headshot_url': headshot_url,
                        'is_active': True
                    }
                    
                    players_data.append(player_data)
                
                # Step 4: Bulk upsert to Supabase
                if players_data:
                    try:
                        # Upsert all players for this team
                        result = supabase.table('players').upsert(
                            players_data,
                            on_conflict='id'
                        ).execute()
                        
                        synced_count = len(players_data)
                        total_players_synced += synced_count
                        print(f"  ✅ Upserted {synced_count} players for team {team_id}")
                        
                    except Exception as upsert_error:
                        # If bulk upsert fails, try one by one
                        print(f"  ⚠️ Bulk upsert failed, trying individual inserts...")
                        synced_count = 0
                        for player in players_data:
                            try:
                                supabase.table('players').upsert(
                                    player,
                                    on_conflict='id'
                                ).execute()
                                synced_count += 1
                            except Exception as e:
                                total_players_failed += 1
                                if total_players_failed <= 3:
                                    print(f"    ❌ Failed to upsert player {player['id']} ({player['full_name']}): {e}")
                        
                        total_players_synced += synced_count
                        if synced_count > 0:
                            print(f"  ✅ Upserted {synced_count}/{len(players_data)} players for team {team_id}")
                
            except Exception as team_error:
                print(f"  ❌ Error syncing team {team_id}: {team_error}")
                total_players_failed += 1
                continue
        
        # Summary
        print(f"\n{'='*60}")
        print(f"Player sync completed!")
        print(f"  Total teams processed: {len(team_ids)}")
        print(f"  Total players synced: {total_players_synced}")
        if total_players_failed > 0:
            print(f"  Total players failed: {total_players_failed}")
        print(f"{'='*60}")
        
        # Verify data insertion
        print("\nVerifying data insertion...")
        verify_result = supabase.table('players').select('id, full_name, team_id').limit(5).execute()
        if verify_result.data:
            print(f"✅ Verification successful! Found players in database")
            print("Sample players:")
            for player in verify_result.data[:3]:
                print(f"  - {player['full_name']} (Team: {player['team_id']})")
        else:
            print("⚠️ Warning: No players found in database after insertion")
        
        print("\n✅ Player sync completed successfully!")
        
    except Exception as e:
        print(f"\n❌ Error during player sync: {str(e)}")
        import traceback
        traceback.print_exc()
        raise

