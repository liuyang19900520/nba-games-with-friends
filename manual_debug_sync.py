
import sys
import os
import logging
from dotenv import load_dotenv

# Setup basic logging to stdout
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(message)s')

# Force load local .env.development
load_dotenv('.env.development')

# Add service dir to path
sys.path.append(os.path.join(os.getcwd(), 'services/data-sync'))

print(f"python path: {sys.path}")

try:
    from services.game_service import sync_single_game
    from db import get_db
    
    game_id = "0022500647"
    print(f"--- Starting Manual Sync for Game {game_id} ---")
    
    result = sync_single_game(game_id)
    
    print("\n--- Sync Result ---")
    print(result)
    
    # Verify in DB
    supabase = get_db()
    
    print("\n--- DB Verification ---")
    # Check Game
    game = supabase.table('games').select('*').eq('id', game_id).execute()
    if game.data:
        g = game.data[0]
        print(f"Game: {g['status']} Score: {g['away_score']}-{g['home_score']}")
    else:
        print("Game NOT found in DB")
        
    # Check Player Stats
    stats = supabase.table('game_player_stats').select('*', count='exact').eq('game_id', game_id).execute()
    print(f"Player Stats Records: {stats.count}")

except Exception as e:
    print(f"\n❌ Error: {e}")
    import traceback
    traceback.print_exc()
