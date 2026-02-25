import sys
import os
import traceback
import dotenv

dotenv.load_dotenv(".env.development")
proxy = os.environ.get("NBA_STATS_PROXY", "None")
print("Proxy Env:", proxy)

from utils import safe_call_nba_api
from nba_api.stats.endpoints import leaguestandings

try:
    res = safe_call_nba_api('LeagueStandings', lambda: leaguestandings.LeagueStandings(season='2024-25'), max_retries=2)
    if res:
        print("SUCCESS")
    else:
        print("FAILED API CALL")
except Exception as e:
    print('FATAL ERROR:', e)
    traceback.print_exc()
