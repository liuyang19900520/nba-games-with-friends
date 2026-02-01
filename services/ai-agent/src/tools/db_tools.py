import os
from typing import List, Optional
from supabase import create_client, Client
from langchain_core.tools import tool
from dotenv import load_dotenv
from datetime import datetime, timedelta
from tools.error_handler import handle_tool_error

# Load environment variables
load_dotenv()

# Initialize Supabase Client
url: str = os.getenv("SUPABASE_URL")
key: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(url, key)

def parse_record(record_str: str) -> str:
    """Helper to convert '15-5' format to '15-5 (75.0%)'."""
    if not record_str or "-" not in record_str:
        return "N/A"
    try:
        w, l = map(int, record_str.split("-"))
        total = w + l
        if total == 0:
            return f"{record_str} (0.0%)"
        pct = (w / total) * 100
        return f"{record_str} ({pct:.1f}%)"
    except:
        return record_str

@tool
def get_team_id_by_code(team_code: str) -> str:
    """
    Find a team's ID (Integer) based on its abbreviation (e.g., 'CLE', 'GSW', 'LAL').
    Use this first if you only have a team code (like 'CLE' for Cavaliers).
    """
    response = supabase.table("teams").select("id, name").eq("code", team_code.upper()).execute()
    if response.data:
        team = response.data[0]
        return f"Found Team: {team['name']} (TEAM_ID: {team['id']})"
    return f"No team found for code: {team_code}"

@tool
def get_team_fundamentals(team_id: int) -> str:
    """
    Module 1: Team Fundamentals. 
    Retrieves a team's basic standing, home/road split, win streaks, and offensive/defensive ratings from the database.
    """
    # Get standings
    standings = supabase.table("team_standings").select("*").eq("team_id", team_id).limit(1).execute()
    # Get advanced stats
    adv_stats = supabase.table("team_season_advanced_stats").select("*").eq("team_id", team_id).limit(1).execute()
    
    team_name_resp = supabase.table("teams").select("name").eq("id", team_id).execute()
    team_name = team_name_resp.data[0]['name'] if team_name_resp.data else f"Team {team_id}"

    result = f"--- [{team_name}] FUNDAMENTALS ---\n"
    
    if standings.data:
        s = standings.data[0]
        result += f"- Standing: {s.get('wins', 0)}-{s.get('losses', 0)} | Conf Rank: {s.get('conf_rank', 'N/A')}\n"
        result += f"- Home: {parse_record(s.get('home_record'))} | Road: {parse_record(s.get('road_record'))}\n"
        result += f"- Current Streak: {s.get('streak', 'N/A')}\n"
    else:
        result += "- Standing: N/A\n"
    
    if adv_stats.data:
        a = adv_stats.data[0]
        off = a.get('off_rating', 'N/A')
        defr = a.get('def_rating', 'N/A')
        net = a.get('net_rating', 'N/A')
        pace = a.get('pace', 'N/A')
        result += f"- Efficiency: OFF {off} | DEF {defr} | NET {net}\n"
        result += f"- Pace: {pace}\n"
    else:
        result += "- Efficiency: N/A\n"
    
    return result

@tool
def get_recent_performance_analysis(team_id: int, limit: int = 5) -> str:
    """
    Module 2: Recent Momentum (Database).
    Analyzes historical games for a team from the DB, calculating win rate and scoring trends.
    """
    response = supabase.table("games").select("*").or_(f"home_team_id.eq.{team_id},away_team_id.eq.{team_id}").order("game_date", desc=True).limit(limit).execute()
    
    if not response.data:
        return "No recent games found in database."
        
    total_games = len(response.data)
    wins = 0
    total_pts = 0
    total_allowed = 0
    
    for g in response.data:
        h_id = int(g.get('home_team_id'))
        h_score = g.get('home_team_score', 0)
        a_score = g.get('away_team_score', 0)
        
        if h_id == team_id:
            total_pts += h_score
            total_allowed += a_score
            if h_score > a_score: wins += 1
        else:
            total_pts += a_score
            total_allowed += h_score
            if a_score > h_score: wins += 1
    
    avg_pts = total_pts / total_games
    avg_allowed = total_allowed / total_games
    win_rate = (wins / total_games) * 100
    
    return (f"--- DB RECENT TREND (Last {total_games} Games) ---\n"
            f"- Record: {wins}W-{total_games-wins}L ({win_rate:.1f}%)\n"
            f"- Avg Scored: {avg_pts:.1f} | Avg Allowed: {avg_allowed:.1f}\n"
            f"- Net PPG: {avg_pts - avg_allowed:+.1f}")

@tool
def get_star_player_trends(team_id: int) -> str:
    """
    Module 4: Star Player Trends (Database).
    Compares recent player stats vs season averages stored in the DB.
    """
    season_stats = supabase.table("player_season_stats").select("player_id, pts").eq("team_id", team_id).order("pts", desc=True).limit(3).execute()
    
    if not season_stats.data:
        return "No star player data found in database."
        
    result = "--- DB STAR PLAYER TRENDS (Last 3 Games vs Season) ---\n"
    
    for p in season_stats.data:
        pid = p['player_id']
        s_pts = p['pts']
        name_resp = supabase.table("players").select("full_name").eq("id", pid).execute()
        name = name_resp.data[0]['full_name'] if name_resp.data else f"Player {pid}"
        recent_resp = supabase.table("game_player_stats").select("pts").eq("player_id", pid).order("game_id", desc=True).limit(3).execute()
        
        if recent_resp.data:
            recent_pts = [r['pts'] for r in recent_resp.data]
            avg_recent = sum(recent_pts) / len(recent_pts)
            diff = avg_recent - s_pts
            trend = f"(+{diff:.1f} Up)" if diff >= 0 else f"({diff:.1f} Down)"
            result += f"- {name}: Season {s_pts:.1f} | Recent {avg_recent:.1f} {trend}\n"
        else:
            result += f"- {name}: Season {s_pts:.1f} | Recent: N/A\n"
    
    return result

@tool
def get_top_players_stats(team_id: int) -> str:
    """
    Get top performing players of a team (Points Per Game) from database.
    """
    stats_resp = supabase.table("player_season_stats").select("player_id, pts, reb, ast").eq("team_id", team_id).order("pts", desc=True).limit(5).execute()
    
    if not stats_resp.data:
        return "No player stats found in DB."
        
    player_ids = [s['player_id'] for s in stats_resp.data]
    names_resp = supabase.table("players").select("id, full_name").in_("id", player_ids).execute()
    name_map = {n['id']: n['full_name'] for n in names_resp.data}
    
    result = "--- TOP PLAYERS (DB Season Averages) ---\n"
    for s in stats_resp.data:
        name = name_map.get(s['player_id'], f"Player {s['player_id']}")
        result += f"{name}: {s['pts']} PTS, {s['reb']} REB, {s['ast']} AST\n"
    
    return result

@tool
def get_schedule_stress_analysis(team_id: int, target_date: str) -> str:
    """
    Module 5: Schedule Context (Database).
    Checks for B2B and game density based on DB records.
    """
    current_dt = datetime.strptime(target_date, "%Y-%m-%d")
    yesterday_str = (current_dt - timedelta(days=1)).strftime("%Y-%m-%d")
    seven_days_ago_str = (current_dt - timedelta(days=7)).strftime("%Y-%m-%d")
    
    response = supabase.table("games").select("game_date, home_team_id").or_(f"home_team_id.eq.{team_id},away_team_id.eq.{team_id}").gte("game_date", seven_days_ago_str).lt("game_date", target_date).order("game_date", desc=True).execute()
    
    games_list = response.data if response.data else []
    game_count = len(games_list)
    is_b2b = any(g['game_date'] == yesterday_str for g in games_list)
    
    road_count = 0
    for g in games_list:
        if int(g['home_team_id']) != team_id:
            road_count += 1
        else:
            break
    
    result = f"--- DB SCHEDULE STRESS (as of {target_date}) ---\n"
    result += f"- Back-to-Back: {'YES' if is_b2b else 'NO'}\n"
    result += f"- 7-Day Density: {game_count} games in 7 days\n"
    result += f"- Road Stress: {road_count} consecutive Away games\n"
    
    return result

@tool
def get_matchup_analysis(team_a_idx: int, team_b_idx: int) -> str:
    """
    Module 3: Matchup & H2H Analysis (Database).
    Compares two teams directly using DB H2H history and ratings.
    """
    response = supabase.table("games").select("*").or_(f"and(home_team_id.eq.{team_a_idx},away_team_id.eq.{team_b_idx}),and(home_team_id.eq.{team_b_idx},away_team_id.eq.{team_a_idx})").order("game_date", desc=True).limit(5).execute()
    
    stats_a = supabase.table("team_season_advanced_stats").select("ts_pct, efg_pct, def_rating").eq("team_id", team_a_idx).limit(1).execute()
    stats_b = supabase.table("team_season_advanced_stats").select("ts_pct, efg_pct, def_rating").eq("team_id", team_b_idx).limit(1).execute()
    
    result = "--- DB MATCHUP ANALYSIS (H2H & Stats) ---\n"
    
    if response.data:
        a_wins = 0
        for g in response.data:
            h_id = int(g.get('home_team_id'))
            h_score = g.get('home_team_score', 0)
            a_score = g.get('away_team_score', 0)
            if (h_id == team_a_idx and h_score > a_score) or (h_id != team_a_idx and a_score > h_score):
                a_wins += 1
        result += f"- H2H Record (Last {len(response.data)}): Team A {a_wins}W - Team B {len(response.data)-a_wins}W\n"
    else:
        result += "- H2H Record: No prior games found.\n"
        
    def get_val(data, key): return data[0].get(key, "N/A") if data else "N/A"
    result += f"- Team A Efficiency: TS% {get_val(stats_a.data, 'ts_pct')} | DEF {get_val(stats_a.data, 'def_rating')}\n"
    result += f"- Team B Efficiency: TS% {get_val(stats_b.data, 'ts_pct')} | DEF {get_val(stats_b.data, 'def_rating')}\n"
    
    return result

# Export tools
db_tools = [
    get_team_id_by_code, 
    get_team_fundamentals, 
    get_recent_performance_analysis, 
    get_star_player_trends, 
    get_matchup_analysis, 
    get_schedule_stress_analysis,
    get_top_players_stats
]

for t in db_tools:
    t.handle_tool_error = handle_tool_error
