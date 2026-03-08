"""
1-Click Lineup Tools
Fetches today's games and top fantasy players from Supabase.
"""
import os
from datetime import datetime, timezone, timedelta
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

url: str = os.getenv("SUPABASE_URL")
key: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY")


def _get_supabase() -> Client:
    return create_client(url, key)


def get_today_game_date() -> str:
    """Get tomorrow's date in Tokyo timezone (JST, UTC+9) as YYYY-MM-DD."""
    jst = timezone(timedelta(hours=9))
    tomorrow = datetime.now(jst) + timedelta(days=1)
    return tomorrow.strftime("%Y-%m-%d")


def get_today_games(game_date: str | None = None, season: str = "2025-26") -> list[dict]:
    """
    Fetch games for the given date from games_tokyo view.
    Returns list of {home_team_id, away_team_id, game_date_tokyo}.
    """
    supabase = _get_supabase()
    if not game_date:
        game_date = get_today_game_date()

    resp = (
        supabase.table("games_tokyo")
        .select("home_team_id, away_team_id, game_date_tokyo")
        .eq("game_date_tokyo", game_date)
        .eq("season", season)
        .execute()
    )
    return resp.data or []


def get_top_fantasy_players(team_ids: list[int], limit: int = 5, season: str = "2025-26") -> list[dict]:
    """
    Fetch top players by fantasy_avg from player_season_stats for given teams.
    Returns list of player dicts with {player_id, pts, reb, ast, fantasy_avg, player_name, team_name, position, headshot_url, team_logo_url}.
    """
    supabase = _get_supabase()

    resp = (
        supabase.table("player_season_stats")
        .select(
            "player_id, pts, reb, ast, stl, blk, fantasy_avg, "
            "player:players!inner(id, full_name, position, headshot_url, team_id, "
            "team:teams(id, name, code, logo_url))"
        )
        .eq("season", season)
        .in_("team_id", team_ids)
        .order("fantasy_avg", desc=True)
        .limit(limit)
        .execute()
    )

    results = []
    for row in resp.data or []:
        player = row.get("player")
        if not player:
            continue
        team = player.get("team")
        results.append({
            "player_id": str(player.get("id", row.get("player_id"))),
            "player_name": player.get("full_name", "Unknown"),
            "position": player.get("position", "C"),
            "headshot_url": player.get("headshot_url", ""),
            "team_name": team.get("name", "Unknown") if team else "Unknown",
            "team_code": team.get("code", "") if team else "",
            "team_logo_url": team.get("logo_url", "") if team else "",
            "pts": row.get("pts", 0),
            "reb": row.get("reb", 0),
            "ast": row.get("ast", 0),
            "fantasy_avg": row.get("fantasy_avg", 0),
        })

    return results
