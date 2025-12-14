"""
Main entry point for NBA data synchronization.
Truncates tables and syncs all data from NBA API to Supabase.
"""
from db import get_db
from services import (
    sync_teams,
    sync_team_standings,
    sync_active_players,
    sync_player_season_stats
)


def truncate_tables():
    """
    Truncate all data tables before syncing to ensure fresh data.
    Tables are truncated in reverse dependency order to avoid foreign key constraints.
    """
    try:
        supabase = get_db()
        print("Truncating tables...")
        
        # Order matters: delete child tables first, then parent tables
        # to avoid foreign key constraint violations
        tables = [
            'player_season_stats',  # Depends on players
            'team_standings',       # Depends on teams
            'players',              # Depends on teams
            'teams'                 # No dependencies
        ]
        
        for table in tables:
            try:
                # Get all records first to count
                all_records = supabase.table(table).select('*').execute()
                record_count = len(all_records.data) if all_records.data else 0
                
                if record_count == 0:
                    print(f"  ✅ {table} table is already empty")
                    continue
                
                # Delete all records
                # For tables with composite keys, delete by unique identifiers
                if table == 'player_season_stats':
                    # Delete by player_id and season
                    for record in all_records.data:
                        supabase.table(table).delete().eq(
                            'player_id', record['player_id']
                        ).eq('season', record['season']).execute()
                elif table == 'team_standings':
                    # Delete by team_id and season
                    for record in all_records.data:
                        supabase.table(table).delete().eq(
                            'team_id', record['team_id']
                        ).eq('season', record['season']).execute()
                elif table in ['teams', 'players']:
                    # Delete by id
                    ids = [r['id'] for r in all_records.data]
                    for id_val in ids:
                        supabase.table(table).delete().eq('id', id_val).execute()
                
                print(f"  ✅ Truncated {table} table ({record_count} records)")
                
            except Exception as e:
                print(f"  ⚠️ Could not truncate {table}: {e}")
                # Continue with other tables even if one fails
                continue
        
        print("✅ All tables truncated successfully\n")
        
    except Exception as e:
        print(f"❌ Error truncating tables: {e}")
        raise


def sync_all_data():
    """
    Main function to sync all NBA data.
    Truncates tables first, then syncs all data.
    """
    try:
        print("=" * 60)
        print("NBA Data Synchronization")
        print("=" * 60)
        print()
        
        # Step 1: Truncate all tables
        truncate_tables()
        
        # Step 2: Sync teams (must be first, as other tables depend on it)
        print("Step 1/4: Syncing teams...")
        sync_teams()
        print()
        
        # Step 3: Sync team standings
        print("Step 2/4: Syncing team standings...")
        sync_team_standings()
        print()
        
        # Step 4: Sync players
        print("Step 3/4: Syncing players...")
        sync_active_players()
        print()
        
        # Step 5: Sync player stats
        print("Step 4/4: Syncing player season stats...")
        sync_player_season_stats()
        print()
        
        print("=" * 60)
        print("✅ All data synchronization completed successfully!")
        print("=" * 60)
        
    except Exception as e:
        print(f"\n❌ Error during data synchronization: {e}")
        import traceback
        traceback.print_exc()
        raise


if __name__ == "__main__":
    sync_all_data()

