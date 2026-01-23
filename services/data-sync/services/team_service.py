"""
Team synchronization service.
Fetches team data from NBA API and syncs to Supabase teams table.
"""
import pandas as pd
from nba_api.stats.endpoints import leaguestandings
from db import get_db
from utils import get_current_nba_season, safe_call_nba_api

# NBA Team ID to Standard Abbreviation mapping
# This is needed because LeagueStandings API doesn't provide abbreviations
TEAM_ID_TO_ABBREVIATION = {
    1610612737: 'ATL',  # Atlanta Hawks
    1610612738: 'BOS',  # Boston Celtics
    1610612751: 'BKN',  # Brooklyn Nets
    1610612766: 'CHA',  # Charlotte Hornets
    1610612741: 'CHI',  # Chicago Bulls
    1610612739: 'CLE',  # Cleveland Cavaliers
    1610612742: 'DAL',  # Dallas Mavericks
    1610612743: 'DEN',  # Denver Nuggets
    1610612765: 'DET',  # Detroit Pistons
    1610612744: 'GSW',  # Golden State Warriors
    1610612745: 'HOU',  # Houston Rockets
    1610612754: 'IND',  # Indiana Pacers
    1610612746: 'LAC',  # LA Clippers
    1610612747: 'LAL',  # Los Angeles Lakers
    1610612763: 'MEM',  # Memphis Grizzlies
    1610612748: 'MIA',  # Miami Heat
    1610612749: 'MIL',  # Milwaukee Bucks
    1610612750: 'MIN',  # Minnesota Timberwolves
    1610612740: 'NOP',  # New Orleans Pelicans
    1610612752: 'NYK',  # New York Knicks
    1610612760: 'OKC',  # Oklahoma City Thunder
    1610612753: 'ORL',  # Orlando Magic
    1610612755: 'PHI',  # Philadelphia 76ers
    1610612756: 'PHX',  # Phoenix Suns
    1610612757: 'POR',  # Portland Trail Blazers
    1610612758: 'SAC',  # Sacramento Kings
    1610612759: 'SAS',  # San Antonio Spurs
    1610612761: 'TOR',  # Toronto Raptors
    1610612762: 'UTA',  # Utah Jazz
    1610612764: 'WAS',  # Washington Wizards
}


def sync_teams() -> None:
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
            
            # Get team code from mapping table (LeagueStandings API doesn't provide abbreviations)
            team_code = TEAM_ID_TO_ABBREVIATION.get(team_id, '')
            
            # Fallback: Try to get from API response if available
            if not team_code:
                for code_col in ['TeamAbbreviation', 'TEAM_ABBREVIATION', 'Abbreviation', 'ABBREVIATION', 'TeamCode', 'TEAM_CODE']:
                    if code_col in row and pd.notna(row.get(code_col)):
                        team_code = str(row.get(code_col)).strip()
                        break
            
            # Last resort: use first 3 letters of team name (shouldn't happen with proper mapping)
            if not team_code and team_name:
                print(f"  ⚠️ Warning: No abbreviation found for team {team_id} ({team_name}), using fallback")
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
        
        # Upsert teams to Supabase (idempotent operation)
        print(f"Syncing {len(teams_data)} teams to Supabase...")
        synced_count = 0
        failed_count = 0
        
        try:
            # Try bulk upsert first
            result = supabase.table('teams').upsert(
                teams_data,
                on_conflict='id'
            ).execute()
            synced_count = len(teams_data)
            print(f"✅ Successfully upserted {synced_count} teams")
            
        except Exception as bulk_error:
            # If bulk upsert fails, try one by one
            print(f"  ⚠️ Bulk upsert failed, trying individual upserts...")
            print(f"  Error: {bulk_error}")
            
            for team in teams_data:
                try:
                    supabase.table('teams').upsert(
                        team,
                        on_conflict='id'
                    ).execute()
                    synced_count += 1
                    if synced_count % 10 == 0:
                        print(f"  Upserted {synced_count} teams...")
                except Exception as e:
                    failed_count += 1
                    if failed_count <= 3:
                        print(f"  ❌ Failed to upsert team {team['id']} ({team['name']}): {e}")
        
        if synced_count > 0:
            print(f"✅ Successfully synced {synced_count}/{len(teams_data)} teams")
        else:
            raise Exception("Failed to sync any teams")
        
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
