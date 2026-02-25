import sys, os
from datetime import datetime
import pytz
import traceback

sys.path.append('.')
from db import get_db
from services.game_service import sync_single_game

try:
    print('Syncing 0022500828')
    res = sync_single_game('0022500828')
    print('Result:', res)
    
    db = get_db()
    g = db.table('games').select('id, status, home_score, away_score').eq('id', '0022500828').execute()
    print('DB Status:', g.data)
except Exception as e:
    traceback.print_exc()
