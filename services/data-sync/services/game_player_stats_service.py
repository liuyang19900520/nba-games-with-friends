"""
Game player statistics synchronization service.
Fetches player stats for a specific game from NBA API and syncs to Supabase game_player_stats table.
"""
from typing import Any, Dict, List, Optional, Tuple
import pandas as pd
from nba_api.stats.endpoints import boxscoretraditionalv3
from db import get_db
from utils import safe_call_nba_api, calculate_fantasy_score


def _safe_int(value: Any, default: int = 0) -> int:
    """
    Safely convert value to integer.
    
    Args:
        value: Value to convert
        default: Default value if conversion fails
    
    Returns:
        Integer value or default
    """
    if pd.isna(value) or value is None or value == '':
        return default
    try:
        return int(float(value))
    except (ValueError, TypeError):
        return default


def _safe_float(value: Any, default: float = 0.0) -> float:
    """
    Safely convert value to float.
    
    Args:
        value: Value to convert
        default: Default value if conversion fails
    
    Returns:
        Float value or default
    """
    if pd.isna(value) or value is None or value == '':
        return default
    try:
        return float(value)
    except (ValueError, TypeError):
        return default


def _fetch_player_stats_from_api(game_id: str) -> Tuple[Optional[List[Dict]], Optional[Dict]]:
    """
    Fetch player statistics for a specific game.

    Tries cdn.nba.com (nba_api.live) first, falls back to BoxScoreTraditionalV3
    (stats.nba.com) if CDN fails.
    """
    print(f"Fetching player stats for game {game_id}...")

    # 1. Try CDN first (cdn.nba.com - no rate limits, no IP blocking)
    try:
        print(f"[game_player_stats_service] Trying Live CDN for {game_id}...")
        cdn_stats, cdn_game_info = _fetch_player_stats_from_live_cdn(game_id)
        if cdn_stats and len(cdn_stats) > 0:
            print(f"[game_player_stats_service] ✅ CDN fetch successful: {len(cdn_stats)} players")
            if cdn_game_info:
                hs = cdn_game_info.get('home_score')
                as_ = cdn_game_info.get('away_score')
                if hs is not None and as_ is not None:
                    print(f"  Game score: {as_} - {hs} (Away - Home)")
            return cdn_stats, cdn_game_info
        print(f"[game_player_stats_service] CDN returned empty data for {game_id}")
    except Exception as e:
        print(f"[game_player_stats_service] CDN fetch failed: {e}, falling back to stats.nba.com")

    # 2. Fallback to BoxScoreTraditionalV3 (stats.nba.com)
    print(f"[game_player_stats_service] Trying BoxScoreTraditionalV3 for {game_id}...")
    boxscore = safe_call_nba_api(
        name=f"BoxScoreTraditionalV3(game_id={game_id})",
        call_fn=lambda: boxscoretraditionalv3.BoxScoreTraditionalV3(game_id=game_id),
        max_retries=10,
        base_delay=3.0,
    )

    if boxscore is None:
        print(f"[game_player_stats_service] Failed to fetch boxscore for game {game_id} after retries.")
        return None, None

    data = boxscore.get_dict()
    box_score_data = data.get('boxScoreTraditional', {})

    if not box_score_data:
        print(f"[game_player_stats_service] No boxScoreTraditional data found for game {game_id}")
        return None, None

    home_team = box_score_data.get('homeTeam', {})
    away_team = box_score_data.get('awayTeam', {})
    home_team_id = box_score_data.get('homeTeamId')
    away_team_id = box_score_data.get('awayTeamId')

    home_score = home_team.get('statistics', {}).get('points')
    away_score = away_team.get('statistics', {}).get('points')

    game_info = {
        'home_score': int(home_score) if home_score is not None else None,
        'away_score': int(away_score) if away_score is not None else None,
        'status': 'Final',
    }

    all_player_stats = []
    for player in home_team.get('players', []):
        if player.get('statistics'):
            all_player_stats.append({
                'PLAYER_ID': player.get('personId'),
                'TEAM_ID': home_team_id,
                'statistics': player.get('statistics', {}),
            })
    for player in away_team.get('players', []):
        if player.get('statistics'):
            all_player_stats.append({
                'PLAYER_ID': player.get('personId'),
                'TEAM_ID': away_team_id,
                'statistics': player.get('statistics', {}),
            })

    if not all_player_stats:
        print(f"[game_player_stats_service] Empty player stats data for game {game_id}")
        return None, None

    print(f"Fetched {len(all_player_stats)} player stats via BoxScoreTraditionalV3 for game {game_id}")
    if home_score is not None and away_score is not None:
        print(f"  Game score: {away_score} - {home_score} (Away - Home)")
    return all_player_stats, game_info


def _parse_iso_duration(duration_str: str) -> str:
    """Convert ISO 8601 duration (PT15M54.70S) to MM:SS"""
    if not duration_str:
        return "00:00"
    try:
        import re
        # Match PT{M}M{S}.{ms}S
        match = re.search(r'PT(\d+)M(\d+)(\.\d+)?S', duration_str)
        if match:
            m = int(match.group(1))
            s = int(match.group(2))
            return f"{m}:{s:02d}"
        
        # Match PT{S}.{ms}S (seconds only)
        match_sec = re.search(r'PT(\d+)(\.\d+)?S', duration_str)
        if match_sec:
             return f"0:{int(match_sec.group(1)):02d}"

        return duration_str # Return original if regex fails
    except:
        return duration_str


def _fetch_player_stats_from_live_cdn(game_id: str) -> Tuple[Optional[List[Dict]], Optional[Dict]]:
    """Fetch stats from nba_api.live (cdn.nba.com) endpoint."""
    from nba_api.live.nba.endpoints import boxscore

    box = boxscore.BoxScore(game_id=game_id)
    data = box.get_dict()
    game = data.get('game', {})

    home_team = game.get('homeTeam', {})
    away_team = game.get('awayTeam', {})

    status_map = {1: 'Scheduled', 2: 'Live', 3: 'Final'}
    status = status_map.get(game.get('gameStatus', 3), 'Final')

    game_info = {
        'home_score': _safe_int(home_team.get('score')),
        'away_score': _safe_int(away_team.get('score')),
        'status': status,
    }
    
    all_player_stats = []
    
    # Process teams
    for team_data, team_type in [(home_team, 'home'), (away_team, 'away')]:
        team_id = team_data.get('teamId')
        players = team_data.get('players', [])
        
        for p in players:
            # Live CDN structure: player -> statistics -> points
            stats = p.get('statistics', {})
            
            # Map Live CDN keys to V3/DB keys
            # DB expects: points, reboundsTotal, assists, etc.
            
            # Convert ISO duration to MM:SS
            min_str = _parse_iso_duration(stats.get('minutes', ''))
            
            mapped_stats = {
                'minutes': min_str,
                'points': stats.get('points'),
                'reboundsTotal': stats.get('reboundsTotal'),
                'assists': stats.get('assists'),
                'steals': stats.get('steals'),
                'blocks': stats.get('blocks'),
                'turnovers': stats.get('turnovers'),
                'foulsPersonal': stats.get('foulsPersonal'),
                'plusMinusPoints': stats.get('plusMinusPoints'),
                'fieldGoalsMade': stats.get('fieldGoalsMade'),
                'fieldGoalsAttempted': stats.get('fieldGoalsAttempted'),
                'fieldGoalsPercentage': stats.get('fieldGoalsPercentage'),
                'threePointersMade': stats.get('threePointersMade'),
                'threePointersAttempted': stats.get('threePointersAttempted'),
                'freeThrowsMade': stats.get('freeThrowsMade'),
                'freeThrowsAttempted': stats.get('freeThrowsAttempted'),
            }
            
            player_stat = {
                'PLAYER_ID': p.get('personId'),
                'TEAM_ID': team_id,
                'statistics': mapped_stats
            }
            all_player_stats.append(player_stat)
            
    return all_player_stats, game_info


def _transform_player_stat(
    stat_dict: Dict,
    game_id: str,
    valid_player_ids: set,
    valid_team_ids: set,
) -> Optional[Dict]:
    """
    Transform NBA API player stat dictionary to Supabase game_player_stats format.
    
    Args:
        stat_dict: Player stat dictionary from NBA API (BoxScoreTraditionalV3 format)
        game_id: Game ID
        valid_player_ids: Set of valid player IDs from players table
        valid_team_ids: Set of valid team IDs from teams table
    
    Returns:
        Transformed player stat dictionary, or None if transformation failed
    """
    # BoxScoreTraditionalV3 structure: { 'PLAYER_ID': int, 'TEAM_ID': int, 'statistics': {...} }
    player_id = _safe_int(stat_dict.get('PLAYER_ID', 0))
    team_id = _safe_int(stat_dict.get('TEAM_ID', 0))
    stats = stat_dict.get('statistics', {})
    
    # Validate foreign keys
    if player_id == 0 or player_id not in valid_player_ids:
        return None  # Skip players not in players table
    
    if team_id == 0 or team_id not in valid_team_ids:
        return None  # Skip teams not in teams table
    
    if not stats:
        return None  # Skip players without statistics
    
    # Extract stats (BoxScoreTraditionalV3 uses different field names)
    min_played = stats.get('minutes', '')
    if min_played and pd.notna(min_played):
        min_played = str(min_played).strip()
    else:
        min_played = None
    
    pts = _safe_int(stats.get('points', 0))
    reb = _safe_int(stats.get('reboundsTotal', 0))
    ast = _safe_int(stats.get('assists', 0))
    stl = _safe_int(stats.get('steals', 0))
    blk = _safe_int(stats.get('blocks', 0))
    tov = _safe_int(stats.get('turnovers', 0))
    pf = _safe_int(stats.get('foulsPersonal', 0))
    plus_minus = _safe_int(stats.get('plusMinusPoints', 0))
    
    fgm = _safe_int(stats.get('fieldGoalsMade', 0))
    fga = _safe_int(stats.get('fieldGoalsAttempted', 0))
    fg_pct = _safe_float(stats.get('fieldGoalsPercentage', 0.0))
    
    fg3m = _safe_int(stats.get('threePointersMade', 0))
    fg3a = _safe_int(stats.get('threePointersAttempted', 0))
    
    ftm = _safe_int(stats.get('freeThrowsMade', 0))
    fta = _safe_int(stats.get('freeThrowsAttempted', 0))
    
    # Calculate fantasy score
    fantasy_score = calculate_fantasy_score(
        float(pts),
        float(reb),
        float(ast),
        float(stl),
        float(blk),
        float(tov),
    )
    
    # Build player stat data
    player_stat_data = {
        'game_id': str(game_id),
        'player_id': player_id,
        'team_id': team_id,
        'min': min_played,
        'fantasy_score': fantasy_score,
        'pts': pts,
        'reb': reb,
        'ast': ast,
        'stl': stl,
        'blk': blk,
        'tov': tov,
        'pf': pf,
        'plus_minus': plus_minus,
        'fgm': fgm,
        'fga': fga,
        'fg_pct': fg_pct,
        'fg3m': fg3m,
        'fg3a': fg3a,
        'ftm': ftm,
        'fta': fta,
    }
    
    return player_stat_data


def sync_game_details(
    game_id: str,
    game_data: Optional[Dict] = None,
    player_stats_list: Optional[List[Dict]] = None,
) -> None:
    """
    Sync player statistics for a specific game to Supabase game_player_stats table.
    
    This function can work in two modes:
    1. Fetch mode: If player_stats_list is None, fetches data from NBA API using game_id
    2. Direct mode: If player_stats_list is provided, uses it directly (useful for batch processing)
    
    Args:
        game_id: NBA game ID (e.g., '0022500009')
        game_data: Optional game data dictionary (currently unused but reserved for future use)
        player_stats_list: Optional list of player stat dictionaries from NBA API.
                          If None, fetches from NBA API using game_id.
    
    Extracts and syncs:
    - game_id, player_id, team_id, min, fantasy_score, pts, reb, ast, stl, blk, tov,
      pf, plus_minus, fgm, fga, fg_pct, fg3m, fg3a, ftm, fta
    """
    try:
        print(f"Starting game player stats sync for game {game_id}...")
        
        # Get Supabase client
        supabase = get_db()
        
        # Fetch player stats from API if not provided
        game_info = None
        if player_stats_list is None:
            player_stats_list, game_info = _fetch_player_stats_from_api(game_id)
            if player_stats_list is None:
                print(f"⚠️ Failed to fetch player stats for game {game_id}. Skipping.")
                return
        
        if len(player_stats_list) == 0:
            print(f"ℹ️ No player stats found for game {game_id}")
            return
        
        # Get valid player and team IDs from database (for foreign key validation)
        print("Fetching valid player and team IDs from database...")
        players_result = supabase.table('players').select('id').execute()
        valid_player_ids = set(player['id'] for player in players_result.data)
        print(f"Found {len(valid_player_ids)} valid players in database")
        
        teams_result = supabase.table('teams').select('id').execute()
        valid_team_ids = set(team['id'] for team in teams_result.data)
        print(f"Found {len(valid_team_ids)} valid teams in database")
        
        # Transform player stats
        print(f"Transforming {len(player_stats_list)} player stats...")
        stats_data = []
        skipped_count = 0
        
        for stat_dict in player_stats_list:
            transformed_stat = _transform_player_stat(
                stat_dict,
                game_id,
                valid_player_ids,
                valid_team_ids,
            )
            
            if transformed_stat:
                stats_data.append(transformed_stat)
            else:
                skipped_count += 1
        
        if skipped_count > 0:
            print(f"Skipped {skipped_count} player stats (missing player/team or invalid data)")
        
        if len(stats_data) == 0:
            print(f"ℹ️ No valid player stats to sync for game {game_id}")
            return
        
        # Delete existing stats for this game first (for idempotency)
        # Then insert new stats
        print(f"Syncing {len(stats_data)} player stats to Supabase...")
        print(f"Deleting existing player stats for game {game_id} (if any)...")
        
        try:
            # Delete existing stats for this game
            delete_result = supabase.table('game_player_stats').delete().eq('game_id', game_id).execute()
            deleted_count = len(delete_result.data) if delete_result.data else 0
            if deleted_count > 0:
                print(f"  Deleted {deleted_count} existing player stats for game {game_id}")
        except Exception as delete_error:
            print(f"  ⚠️ Warning: Failed to delete existing stats: {delete_error}")
            print(f"  Continuing with insert anyway...")
        
        # Insert new stats
        synced_count = 0
        failed_count = 0
        
        try:
            # Try bulk insert first
            result = supabase.table('game_player_stats').insert(stats_data).execute()
            synced_count = len(stats_data)
            print(f"✅ Successfully inserted {synced_count} player stats")
            
        except Exception as bulk_error:
            # If bulk insert fails, try one by one
            print(f"⚠️ Bulk insert failed, trying individual inserts...")
            
            for stat_data in stats_data:
                try:
                    supabase.table('game_player_stats').insert(stat_data).execute()
                    synced_count += 1
                except Exception as e:
                    failed_count += 1
                    if failed_count <= 3:
                        print(f"  ❌ Failed to insert stats for player {stat_data.get('player_id')}: {e}")
            
            if synced_count > 0:
                print(f"✅ Inserted {synced_count}/{len(stats_data)} player stats")
            else:
                print(f"❌ Failed to insert any player stats for game {game_id}")
                raise Exception(f"Failed to sync player stats: {bulk_error}")
        
        # Verify data insertion
        print("\nVerifying data insertion...")
        verify_result = supabase.table('game_player_stats').select(
            'game_id, player_id, pts, reb, ast, fantasy_score'
        ).eq('game_id', game_id).limit(5).execute()
        
        if verify_result.data:
            print(f"✅ Verification successful! Found player stats for game {game_id}")
            print("Sample player stats:")
            for stat in verify_result.data[:3]:
                print(
                    f"  - Player {stat['player_id']}: {stat['pts']} PTS, "
                    f"{stat['reb']} REB, {stat['ast']} AST, Fantasy: {stat['fantasy_score']}"
                )
        else:
            print(f"⚠️ Warning: No player stats found in database for game {game_id} after insertion")
        
        # Update game score and status in games table if we have game info
        if game_info:
            print(f"\nUpdating game score and status in games table...")
            try:
                # Build update data (only include fields that have values)
                update_data = {'id': str(game_id)}
                
                if game_info.get('home_score') is not None:
                    update_data['home_score'] = game_info['home_score']
                if game_info.get('away_score') is not None:
                    update_data['away_score'] = game_info['away_score']
                if game_info.get('status'):
                    update_data['status'] = game_info['status']
                
                # Update game record
                result = supabase.table('games').update(update_data).eq('id', game_id).execute()
                
                if result.data:
                    print(f"✅ Successfully updated game {game_id}:")
                    if 'home_score' in update_data and 'away_score' in update_data:
                        print(f"  Score: {update_data['away_score']} - {update_data['home_score']} (Away - Home)")
                    if 'status' in update_data:
                        print(f"  Status: {update_data['status']}")
                else:
                    print(f"⚠️ Warning: Game {game_id} not found in games table. Skipping score update.")
                    
            except Exception as update_error:
                print(f"⚠️ Warning: Failed to update game score/status: {update_error}")
                print(f"  Player stats were synced successfully, but game info update failed.")
        
        print(f"\n✅ Game player stats sync completed successfully for game {game_id}!")
        
    except Exception as e:
        print(f"\n❌ Error during game player stats sync for game {game_id}: {str(e)}")
        import traceback
        traceback.print_exc()
        raise
