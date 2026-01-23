"""
Deep Audit - Check all tables for data freshness and completeness.

All times are displayed in Tokyo Time (JST, UTC+9).

Usage:
    cd py-data-sync-service
    python check-data/deep_audit.py
"""
import os
import sys
from datetime import datetime, timedelta
from collections import defaultdict
from dotenv import load_dotenv
import pytz

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env.development'))

from supabase import create_client

SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

# Timezone: Tokyo (JST)
TOKYO_TZ = pytz.timezone('Asia/Tokyo')

SEASON = "2025-26"
TODAY = datetime.now(TOKYO_TZ)
TODAY_STR = TODAY.strftime("%Y-%m-%d")


def print_header(title: str):
    print()
    print("=" * 70)
    print(f"  {title}")
    print("=" * 70)


def check_games_table(client) -> dict:
    """Deep check on games table."""
    print_header("GAMES TABLE ANALYSIS")

    # Get all games
    result = client.table("games") \
        .select("id, game_date, status, home_score, away_score, updated_at") \
        .eq("season", SEASON) \
        .order("game_date", desc=True) \
        .execute()

    games = result.data

    # Categorize games
    final_with_scores = []
    final_no_scores = []
    scheduled_past = []
    scheduled_future = []
    in_progress = []

    for g in games:
        if g['status'] == 'Final':
            if g['home_score'] is not None and g['away_score'] is not None:
                final_with_scores.append(g)
            else:
                final_no_scores.append(g)
        elif g['status'] == 'Scheduled':
            if g['game_date'] < TODAY_STR:
                scheduled_past.append(g)
            else:
                scheduled_future.append(g)
        elif g['status'] == 'In Progress':
            in_progress.append(g)

    print(f"Total games: {len(games)}")
    print(f"\nBreakdown:")
    print(f"  Final (with scores):    {len(final_with_scores)}")
    print(f"  Final (NO scores):      {len(final_no_scores)}")
    print(f"  Scheduled (past date):  {len(scheduled_past)}")
    print(f"  Scheduled (future):     {len(scheduled_future)}")
    print(f"  In Progress:            {len(in_progress)}")

    # Sample of games without scores
    if final_no_scores:
        print(f"\nSample Final games missing scores (most recent 5):")
        for g in sorted(final_no_scores, key=lambda x: x['game_date'], reverse=True)[:5]:
            print(f"    {g['id']} | {g['game_date']} | updated: {g['updated_at'][:10] if g['updated_at'] else 'N/A'}")

    return {
        "total": len(games),
        "final_with_scores": len(final_with_scores),
        "final_no_scores": len(final_no_scores),
        "final_no_scores_ids": [g['id'] for g in final_no_scores],
        "scheduled_past": len(scheduled_past),
        "scheduled_past_ids": [g['id'] for g in scheduled_past],
        "needs_sync": len(final_no_scores) + len(scheduled_past)
    }


def check_game_player_stats(client, games_info: dict) -> dict:
    """Check game_player_stats coverage."""
    print_header("GAME_PLAYER_STATS TABLE ANALYSIS")

    # Get all game_ids that have stats
    result = client.table("game_player_stats").select("game_id").execute()
    stats_game_ids = set(row['game_id'] for row in result.data)

    # Get total row count
    count_result = client.table("game_player_stats").select("*", count="exact").limit(0).execute()
    total_rows = count_result.count

    print(f"Total stat rows: {total_rows}")
    print(f"Unique games with stats: {len(stats_game_ids)}")

    # Check which final games have stats
    result = client.table("games") \
        .select("id") \
        .eq("season", SEASON) \
        .eq("status", "Final") \
        .execute()

    all_final_game_ids = set(g['id'] for g in result.data)
    games_missing_stats = all_final_game_ids - stats_game_ids

    print(f"\nFinal games total: {len(all_final_game_ids)}")
    print(f"Final games WITH stats: {len(stats_game_ids & all_final_game_ids)}")
    print(f"Final games WITHOUT stats: {len(games_missing_stats)}")

    if games_missing_stats:
        # Get dates for missing games
        result = client.table("games") \
            .select("id, game_date") \
            .in_("id", list(games_missing_stats)[:100]) \
            .order("game_date") \
            .execute()

        missing_by_date = defaultdict(list)
        for g in result.data:
            missing_by_date[g['game_date']].append(g['id'])

        print(f"\nMissing stats by date (first 10 dates):")
        for date in sorted(missing_by_date.keys())[:10]:
            print(f"    {date}: {len(missing_by_date[date])} games")

    return {
        "total_rows": total_rows,
        "games_with_stats": len(stats_game_ids),
        "games_missing_stats": len(games_missing_stats),
        "missing_game_ids": list(games_missing_stats)
    }


def check_player_season_stats(client) -> dict:
    """Check player_season_stats freshness."""
    print_header("PLAYER_SEASON_STATS TABLE ANALYSIS")

    result = client.table("player_season_stats") \
        .select("*") \
        .eq("season", SEASON) \
        .execute()

    stats = result.data
    updated_dates = []

    print(f"Total player season stats: {len(stats)}")

    if stats:
        # Check updated_at timestamps
        updated_dates = [s.get('updated_at', '')[:10] for s in stats if s.get('updated_at')]
        if updated_dates:
            latest_update = max(updated_dates)
            oldest_update = min(updated_dates)
            print(f"Last updated range: {oldest_update} to {latest_update}")

            # Count by update date
            date_counts = defaultdict(int)
            for d in updated_dates:
                date_counts[d] += 1

            print(f"\nRecent updates:")
            for date in sorted(date_counts.keys(), reverse=True)[:5]:
                print(f"    {date}: {date_counts[date]} players")

        # Sample high-GP players
        high_gp = sorted(stats, key=lambda x: x.get('gp', 0), reverse=True)[:5]
        print(f"\nTop 5 by games played:")
        for p in high_gp:
            print(f"    Player {p['player_id']}: {p.get('gp', 0)} GP, {p.get('pts', 0):.1f} PPG")

    return {
        "total": len(stats),
        "latest_update": max(updated_dates) if stats and updated_dates else None
    }


def check_player_season_advanced_stats(client) -> dict:
    """Check player_season_advanced_stats freshness."""
    print_header("PLAYER_SEASON_ADVANCED_STATS TABLE ANALYSIS")

    result = client.table("player_season_advanced_stats") \
        .select("player_id, season, gp, updated_at") \
        .eq("season", SEASON) \
        .execute()

    stats = result.data
    updated_dates = []

    print(f"Total player advanced stats: {len(stats)}")

    if stats:
        updated_dates = [s.get('updated_at', '')[:10] for s in stats if s.get('updated_at')]
        if updated_dates:
            latest_update = max(updated_dates)
            print(f"Last updated: {latest_update}")

    return {
        "total": len(stats),
        "latest_update": max(updated_dates) if stats and updated_dates else None
    }


def check_team_standings(client) -> dict:
    """Check team_standings freshness."""
    print_header("TEAM_STANDINGS TABLE ANALYSIS")

    result = client.table("team_standings") \
        .select("*") \
        .eq("season", SEASON) \
        .execute()

    standings = result.data
    updated_dates = []
    total_games_from_standings = 0

    print(f"Total team standings: {len(standings)}")

    if standings:
        updated_dates = [s.get('updated_at', '')[:10] for s in standings if s.get('updated_at')]
        if updated_dates:
            latest_update = max(updated_dates)
            print(f"Last updated: {latest_update}")

        # Check total wins/losses
        total_wins = sum(s.get('wins', 0) for s in standings)
        total_losses = sum(s.get('losses', 0) for s in standings)
        total_games_from_standings = (total_wins + total_losses) // 2

        print(f"\nTotal W/L across all teams: {total_wins}W / {total_losses}L")
        print(f"Implied total games played: {total_games_from_standings}")

        # Top teams
        top_teams = sorted(standings, key=lambda x: x.get('wins', 0), reverse=True)[:5]
        print(f"\nTop 5 teams by wins:")
        for t in top_teams:
            print(f"    Team {t['team_id']}: {t.get('wins', 0)}-{t.get('losses', 0)}")

    return {
        "total": len(standings),
        "latest_update": max(updated_dates) if standings and updated_dates else None,
        "total_games_implied": total_games_from_standings
    }


def check_team_season_advanced_stats(client) -> dict:
    """Check team_season_advanced_stats freshness."""
    print_header("TEAM_SEASON_ADVANCED_STATS TABLE ANALYSIS")

    result = client.table("team_season_advanced_stats") \
        .select("team_id, season, gp, w, l, updated_at") \
        .eq("season", SEASON) \
        .execute()

    stats = result.data
    updated_dates = []

    print(f"Total team advanced stats: {len(stats)}")

    if stats:
        updated_dates = [s.get('updated_at', '')[:10] for s in stats if s.get('updated_at')]
        if updated_dates:
            latest_update = max(updated_dates)
            print(f"Last updated: {latest_update}")

        total_gp = sum(s.get('gp', 0) for s in stats)
        print(f"Total GP across all teams: {total_gp}")

    return {
        "total": len(stats),
        "latest_update": max(updated_dates) if stats and updated_dates else None
    }


def check_game_player_advanced_stats(client) -> dict:
    """Check if game_player_advanced_stats table exists and its status."""
    print_header("GAME_PLAYER_ADVANCED_STATS TABLE ANALYSIS")

    try:
        result = client.table("game_player_advanced_stats").select("game_id", count="exact").limit(0).execute()
        total_rows = result.count

        # Get unique game count
        result = client.table("game_player_advanced_stats").select("game_id").execute()
        game_ids = set(row['game_id'] for row in result.data)

        print(f"Total rows: {total_rows}")
        print(f"Unique games: {len(game_ids)}")

        return {
            "exists": True,
            "total_rows": total_rows,
            "games_covered": len(game_ids)
        }
    except Exception as e:
        print(f"Table not found or error: {e}")
        return {"exists": False}


def generate_summary(audit_results: dict):
    """Generate summary with freshness indicators."""
    print_header("DATA FRESHNESS SUMMARY")

    print(f"\n{'Table':<35} {'Rows':<10} {'Last Updated':<15} {'Status'}")
    print("-" * 70)

    tables = [
        ("games", audit_results['games']['total'], "N/A",
         "NEEDS SYNC" if audit_results['games']['final_no_scores'] > 0 else "OK"),
        ("game_player_stats", audit_results['game_player_stats']['total_rows'], "N/A",
         "NEEDS SYNC" if audit_results['game_player_stats']['games_missing_stats'] > 0 else "OK"),
        ("game_player_advanced_stats",
         audit_results['game_player_advanced_stats'].get('total_rows', 0), "N/A",
         "OK" if audit_results['game_player_advanced_stats'].get('exists') else "MISSING"),
        ("player_season_stats", audit_results['player_season_stats']['total'],
         audit_results['player_season_stats']['latest_update'] or "N/A", "CHECK"),
        ("player_season_advanced_stats", audit_results['player_season_advanced_stats']['total'],
         audit_results['player_season_advanced_stats']['latest_update'] or "N/A", "CHECK"),
        ("team_standings", audit_results['team_standings']['total'],
         audit_results['team_standings']['latest_update'] or "N/A", "CHECK"),
        ("team_season_advanced_stats", audit_results['team_season_advanced_stats']['total'],
         audit_results['team_season_advanced_stats']['latest_update'] or "N/A", "CHECK"),
    ]

    for name, rows, updated, status in tables:
        status_icon = "OK" if status == "OK" else "NEEDS SYNC" if "SYNC" in status else "CHECK"
        print(f"{name:<35} {rows:<10} {updated:<15} {status_icon}")

    print("\n" + "=" * 70)
    print("  RECOMMENDED ACTION: python check-data/backfill_data.py --all")
    print("=" * 70)


def main():
    print()
    print("*" * 70)
    print("*" + " " * 68 + "*")
    print("*" + "              DEEP DATA AUDIT - ALL TABLES".center(68) + "*")
    print("*" + f"    Season: {SEASON}  |  Run: {TODAY.strftime('%Y-%m-%d %H:%M JST')}".center(68) + "*")
    print("*" + " " * 68 + "*")
    print("*" * 70)

    client = create_client(SUPABASE_URL, SUPABASE_KEY)

    results = {}

    # Run all checks
    results['games'] = check_games_table(client)
    results['game_player_stats'] = check_game_player_stats(client, results['games'])
    results['game_player_advanced_stats'] = check_game_player_advanced_stats(client)
    results['player_season_stats'] = check_player_season_stats(client)
    results['player_season_advanced_stats'] = check_player_season_advanced_stats(client)
    results['team_standings'] = check_team_standings(client)
    results['team_season_advanced_stats'] = check_team_season_advanced_stats(client)

    # Generate summary
    generate_summary(results)

    print()


if __name__ == "__main__":
    main()
