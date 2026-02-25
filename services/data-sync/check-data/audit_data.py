"""
NBA Database Health Check & Integrity Audit
Comprehensive audit for the 2025-26 season data.

All times are displayed in Tokyo Time (JST, UTC+9).

Usage:
    cd py-data-sync-service
    python check-data/audit_data.py
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

# Season parameters
SEASON = "2025-26"
SEASON_START = datetime(2025, 10, 22)  # NBA 2025-26 season start
TODAY = datetime.now(TOKYO_TZ)


def print_header(title: str):
    print()
    print("=" * 70)
    print(f"  {title}")
    print("=" * 70)


def print_subheader(title: str):
    print()
    print(f"--- {title} ---")


def audit_team_completeness(client) -> dict:
    """Check if all 30 NBA teams exist."""
    print_header("1. TEAM COMPLETENESS")

    result = client.table("teams").select("id, name, conference").execute()
    teams = result.data

    team_count = len(teams)
    conferences = defaultdict(list)
    for t in teams:
        conferences[t['conference']].append(t['name'])

    print(f"Total teams: {team_count}/30")

    if team_count == 30:
        print("Status: PASS - All 30 NBA teams present")
    else:
        print(f"Status: FAIL - Missing {30 - team_count} teams")

    print(f"\nEastern Conference: {len(conferences.get('East', []))} teams")
    print(f"Western Conference: {len(conferences.get('West', []))} teams")

    return {"status": "PASS" if team_count == 30 else "FAIL", "count": team_count}


def audit_schedule_coverage(client) -> dict:
    """Check schedule coverage for the 2025-26 season."""
    print_header("2. SCHEDULE COVERAGE (Season 2025-26)")

    # Get all games for the season
    result = client.table("games") \
        .select("id, game_datetime, status") \
        .eq("season", SEASON) \
        .order("game_datetime") \
        .execute()

    games = result.data
    total_games = len(games)

    print(f"Total games recorded: {total_games}")

    if not games:
        print("Status: FAIL - No games found for season 2025-26")
        return {"status": "FAIL", "total_games": 0, "gaps": []}

    # Parse dates and check coverage (extract date from game_datetime)
    game_dates = sorted(set(g['game_datetime'][:10] for g in games if g.get('game_datetime')))
    first_date = game_dates[0]
    last_date = game_dates[-1]

    print(f"Date range: {first_date} to {last_date}")

    # Count by status
    status_counts = defaultdict(int)
    for g in games:
        status_counts[g['status']] += 1

    print("\nGames by status:")
    for status, count in sorted(status_counts.items()):
        print(f"  {status}: {count}")

    # Check for date gaps (more than 4 days without games)
    print_subheader("Date Gap Analysis")

    gaps = []
    for i in range(1, len(game_dates)):
        prev_date = datetime.strptime(game_dates[i-1], "%Y-%m-%d")
        curr_date = datetime.strptime(game_dates[i], "%Y-%m-%d")
        gap_days = (curr_date - prev_date).days

        if gap_days > 4:
            gaps.append({
                "from": game_dates[i-1],
                "to": game_dates[i],
                "days": gap_days
            })

    if gaps:
        print(f"Found {len(gaps)} gaps > 4 days:")
        for gap in gaps[:10]:  # Show first 10
            print(f"  {gap['from']} -> {gap['to']} ({gap['days']} days)")
    else:
        print("No significant gaps (>4 days) found in schedule")

    # Check expected vs actual game count
    # NBA regular season: 30 teams * 82 games / 2 = 1230 games
    expected_total = 1230
    print(f"\nExpected total games (regular season): {expected_total}")
    print(f"Current coverage: {total_games}/{expected_total} ({100*total_games/expected_total:.1f}%)")

    return {
        "status": "OK" if total_games > 0 else "FAIL",
        "total_games": total_games,
        "date_range": f"{first_date} to {last_date}",
        "gaps": gaps,
        "status_breakdown": dict(status_counts)
    }


def audit_game_integrity(client) -> dict:
    """Check game data integrity."""
    print_header("3. GAME INTEGRITY (Status vs Scores)")

    issues = []

    # Check 1: Final games without scores
    print_subheader("Final games missing scores")

    result = client.table("games") \
        .select("id, game_datetime, status, home_score, away_score, home_team_id, away_team_id") \
        .eq("status", "Final") \
        .eq("season", SEASON) \
        .execute()

    final_games = result.data
    missing_scores = [g for g in final_games if g['home_score'] is None or g['away_score'] is None]

    if missing_scores:
        print(f"WARNING: {len(missing_scores)} Final games have missing scores!")
        for g in missing_scores[:5]:
            game_date = g['game_datetime'][:10] if g.get('game_datetime') else 'N/A'
            print(f"  Game {g['id']} on {game_date}: home={g['home_score']}, away={g['away_score']}")
        issues.append({"type": "final_no_score", "count": len(missing_scores), "examples": missing_scores[:5]})
    else:
        print(f"PASS: All {len(final_games)} Final games have scores")

    # Check 2: Scheduled games in the past (CRITICAL CHECK)
    # All games before today should have status='Final' (not 'Scheduled')
    print_subheader("Orphaned/stuck scheduled games (past dates) - CRITICAL")

    # Use Tokyo timezone for today boundary
    today_start = TODAY.strftime("%Y-%m-%d") + "T00:00:00+09:00"

    result = client.table("games") \
        .select("id, game_datetime, status, home_team_id, away_team_id") \
        .eq("status", "Scheduled") \
        .eq("season", SEASON) \
        .lt("game_datetime", today_start) \
        .order("game_datetime") \
        .execute()

    orphaned_games = result.data

    if orphaned_games:
        print(f"⚠️  CRITICAL: {len(orphaned_games)} games are 'Scheduled' but game_datetime is in the past!")
        print(f"   All past games should have status='Final'.")
        print(f"\n   Sample orphaned games:")
        for g in orphaned_games[:10]:
            game_date = g['game_datetime'][:10] if g.get('game_datetime') else 'N/A'
            print(f"     Game {g['id']} on {game_date}")
        if len(orphaned_games) > 10:
            print(f"     ... and {len(orphaned_games) - 10} more")
        print(f"\n   → Fix: python check-data/backfill_data.py --phase1")
        issues.append({"type": "orphaned_scheduled", "count": len(orphaned_games), "examples": orphaned_games[:10]})
    else:
        print("✓ PASS: All past games have correct status (no orphaned scheduled games)")

    # Check 3: In Progress games (should be rare unless during live games)
    result = client.table("games") \
        .select("id, game_datetime, status") \
        .eq("status", "In Progress") \
        .eq("season", SEASON) \
        .execute()

    in_progress = result.data
    if in_progress:
        print_subheader("Games currently 'In Progress'")
        print(f"Found {len(in_progress)} games in progress:")
        for g in in_progress:
            game_date = g['game_datetime'][:10] if g.get('game_datetime') else 'N/A'
            print(f"  Game {g['id']} on {game_date}")

    return {
        "status": "FAIL" if issues else "PASS",
        "issues": issues,
        "final_games_count": len(final_games),
        "orphaned_count": len(orphaned_games)
    }


def audit_stats_coverage(client) -> dict:
    """Check player stats coverage for completed games."""
    print_header("4. STATS COVERAGE (Critical Check)")

    # Get all Final games
    result = client.table("games") \
        .select("id, game_datetime") \
        .eq("status", "Final") \
        .eq("season", SEASON) \
        .order("game_datetime") \
        .execute()

    # Extract date from game_datetime for display
    final_games = {g['id']: g['game_datetime'][:10] if g.get('game_datetime') else 'N/A' for g in result.data}
    final_game_count = len(final_games)

    print(f"Total Final games: {final_game_count}")

    # Get distinct game_ids from game_player_stats
    result = client.table("game_player_stats") \
        .select("game_id") \
        .execute()

    stats_game_ids = set(row['game_id'] for row in result.data)
    stats_game_count = len(stats_game_ids)

    print(f"Games with player stats: {stats_game_count}")

    # Find Final games without stats
    missing_stats_ids = set(final_games.keys()) - stats_game_ids

    if missing_stats_ids:
        print(f"\nWARNING: {len(missing_stats_ids)} Final games have NO player stats!")

        # Get details for missing games
        missing_games = []
        for gid in list(missing_stats_ids)[:20]:
            if gid in final_games:
                missing_games.append({"id": gid, "date": final_games[gid]})

        # Sort by date
        missing_games.sort(key=lambda x: x['date'])

        print("\nTop 10 missing games (by date):")
        for g in missing_games[:10]:
            print(f"  Game {g['id']} on {g['date']}")

        # Check for date patterns
        if missing_games:
            dates = [g['date'] for g in missing_games]
            min_date = min(dates)
            max_date = max(dates)
            print(f"\nMissing stats date range: {min_date} to {max_date}")

            # Group by month
            monthly = defaultdict(int)
            for d in dates:
                month = d[:7]  # YYYY-MM
                monthly[month] += 1

            print("\nMissing stats by month:")
            for month, count in sorted(monthly.items()):
                print(f"  {month}: {count} games")

    else:
        print("\nPASS: All Final games have player stats")

    # Coverage percentage
    coverage_pct = (stats_game_count / final_game_count * 100) if final_game_count > 0 else 0
    print(f"\nStats coverage: {coverage_pct:.1f}%")

    return {
        "status": "FAIL" if missing_stats_ids else "PASS",
        "final_games": final_game_count,
        "games_with_stats": stats_game_count,
        "missing_count": len(missing_stats_ids),
        "missing_game_ids": list(missing_stats_ids)[:20],
        "coverage_pct": coverage_pct
    }


def generate_summary(results: dict):
    """Generate final summary report."""
    print_header("AUDIT SUMMARY")

    print("\nCheck Results:")
    print(f"  1. Team Completeness:    {results['teams']['status']}")
    print(f"  2. Schedule Coverage:    {results['schedule']['status']}")
    print(f"  3. Game Integrity:       {results['integrity']['status']}")
    print(f"  4. Stats Coverage:       {results['stats']['status']}")

    # Key findings
    print("\n" + "=" * 70)
    print("  KEY FINDINGS & RECOMMENDATIONS")
    print("=" * 70)

    findings = []

    # Schedule findings
    if results['schedule']['total_games'] < 600:
        findings.append(f"- Schedule incomplete: Only {results['schedule']['total_games']} games recorded")

    if results['schedule'].get('gaps'):
        findings.append(f"- Found {len(results['schedule']['gaps'])} date gaps > 4 days in schedule")

    # Integrity findings
    if results['integrity']['orphaned_count'] > 0:
        findings.append(f"- {results['integrity']['orphaned_count']} orphaned games (Scheduled but past date)")

    # Stats findings
    if results['stats']['missing_count'] > 0:
        findings.append(f"- {results['stats']['missing_count']} Final games missing player stats ({100-results['stats']['coverage_pct']:.1f}% gap)")

    if findings:
        print("\nIssues Found:")
        for f in findings:
            print(f"  {f}")

        print("\nRecommended Actions:")
        if results['stats']['missing_count'] > 0:
            print("  1. Run: python check-data/backfill_data.py --all")
        if results['integrity']['orphaned_count'] > 0:
            print("  2. Update status for orphaned scheduled games")
    else:
        print("\n  All checks passed! Database is healthy.")


def main():
    print()
    print("*" * 70)
    print("*" + " " * 68 + "*")
    print("*" + "    NBA DATABASE HEALTH CHECK & INTEGRITY AUDIT".center(68) + "*")
    print("*" + f"    Season: {SEASON}  |  Run: {TODAY.strftime('%Y-%m-%d %H:%M JST')}".center(68) + "*")
    print("*" + " " * 68 + "*")
    print("*" * 70)

    client = create_client(SUPABASE_URL, SUPABASE_KEY)

    results = {}

    # Run all audits
    results['teams'] = audit_team_completeness(client)
    results['schedule'] = audit_schedule_coverage(client)
    results['integrity'] = audit_game_integrity(client)
    results['stats'] = audit_stats_coverage(client)

    # Generate summary
    generate_summary(results)

    print()


if __name__ == "__main__":
    main()
