"""
Team synchronization service.
Fetches team data from NBA API and syncs to Supabase teams table.
"""
import pandas as pd
from nba_api.stats.endpoints import leaguestandings
from db import get_db
from utils import get_current_nba_season, safe_call_nba_api


def sync_teams():
    """
    Sync teams from NBA API to Supabase teams table.
    
    Fetches current season standings and extracts static team info:
    - id, name, city, code, conference, logo_url
    """
    try:
        print("Starting team sync...")
        
        # Get current NBA season
        season = get_current_nba_season()
        print(f"Current NBA season: {season}")
        
        # Fetch data from NBA API with retries
        print("Fetching data from NBA API (LeagueStandings)...")
        standings = safe_call_nba_api(
            name=f"LeagueStandings(season={season})",
            call_fn=lambda: leaguestandings.LeagueStandings(season=season),
            max_retries=3,
            base_delay=3.0,
        )
        if standings is None:
            print("[team_service] Failed to fetch LeagueStandings after retries. "
                  "Skipping team sync for this run.")
            return
        df = standings.get_data_frames()[0]
        
        if df.empty:
            print("Warning: No data received from NBA API")
            return
        
        print(f"Fetched {len(df)} teams from NBA API")
        
        # Get Supabase client
        supabase = get_db()
        
        # Transform data
        print("Transforming team data...")
        teams_data = []
        
        for _, row in df.iterrows():
            team_id = int(row.get('TeamID', row.get('TEAM_ID', 0)))
            team_name = str(row.get('TeamName', row.get('TEAM_NAME', row.get('Team', '')))).strip()
            team_city = str(row.get('TeamCity', row.get('TEAM_CITY', ''))).strip()
            
            # Try to get team code from various possible column names
            team_code = ''
            for code_col in ['TeamAbbreviation', 'TEAM_ABBREVIATION', 'Abbreviation', 'ABBREVIATION', 'TeamCode', 'TEAM_CODE']:
                if code_col in row and pd.notna(row.get(code_col)):
                    team_code = str(row.get(code_col)).strip()
                    break
            
            # If no code found, use first 3 letters of team name
            if not team_code and team_name:
                team_code = team_name[:3].upper() if len(team_name) >= 3 else team_name.upper()
            
            conference = str(row.get('Conference', row.get('CONFERENCE', ''))).strip()
            logo_url = f"https://cdn.nba.com/logos/nba/{team_id}/global/L/logo.svg"
            
            teams_data.append({
                'id': team_id,
                'name': team_name,
                'city': team_city,
                'code': team_code,
                'conference': conference,
                'logo_url': logo_url
            })
        
        # Insert/Update teams to Supabase
        print(f"Syncing {len(teams_data)} teams to Supabase...")
        inserted_count = 0
        failed_count = 0
        
        for team in teams_data:
            try:
                # Try insert first
                supabase.table('teams').insert(team).execute()
                inserted_count += 1
                if inserted_count % 10 == 0:
                    print(f"  Inserted {inserted_count} teams...")
            except Exception:
                # If insert fails, try update
                try:
                    supabase.table('teams').update({
                        'name': team['name'],
                        'city': team['city'],
                        'code': team['code'],
                        'conference': team['conference'],
                        'logo_url': team['logo_url']
                    }).eq('id', team['id']).execute()
                    inserted_count += 1
                except Exception as e:
                    failed_count += 1
                    if failed_count <= 3:
                        print(f"  ❌ Failed team {team['id']} ({team['name']}): {e}")
        
        if inserted_count > 0:
            print(f"✅ Successfully synced {inserted_count}/{len(teams_data)} teams")
        else:
            raise Exception("Failed to insert any teams")
        
        # Verify data insertion
        print("\nVerifying data insertion...")
        verify_result = supabase.table('teams').select('id, name').limit(5).execute()
        if verify_result.data:
            print(f"✅ Verification successful! Found teams in database")
            print("Sample teams:")
            for team in verify_result.data[:3]:
                print(f"  - {team}")
        else:
            print("⚠️ Warning: No teams found in database after insertion")
        
        print("\n✅ Team sync completed successfully!")
        
    except Exception as e:
        print(f"\n❌ Error during team sync: {str(e)}")
        import traceback
        traceback.print_exc()
        raise
