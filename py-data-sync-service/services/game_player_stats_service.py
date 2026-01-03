"""
Game player statistics synchronization service.
Fetches player stats for a specific game from NBA API and syncs to Supabase game_player_stats table.
"""
from typing import Any, Dict, List, Optional, Tuple
import pandas as pd
from nba_api.stats.endpoints import boxscoretraditionalv3
from db import get_db
from utils import safe_call_nba_api


def _calculate_fantasy_score(
    pts: float,
    reb: float,
    ast: float,
    stl: float,
    blk: float,
    tov: float,
) -> float:
    """
    Calculate fantasy score using the standard formula.
    
    Formula: (PTS * 1.0) + (REB * 1.2) + (AST * 1.5) + (STL * 3.0) + (BLK * 3.0) - (TOV * 1.0)
    
    Args:
        pts: Points scored
        reb: Rebounds
        ast: Assists
        stl: Steals
        blk: Blocks
        tov: Turnovers
    
    Returns:
        Fantasy score rounded to 1 decimal place
    """
    return round(
        (pts * 1.0) + (reb * 1.2) + (ast * 1.5) + (stl * 3.0) + (blk * 3.0) - (tov * 1.0),
        1
    )


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
    Fetch player statistics for a specific game from NBA API.
    
    Args:
        game_id: NBA game ID (e.g., '0022500009')
    
    Returns:
        List of player stat dictionaries, or None if fetch failed
    """
    print(f"Fetching player stats for game {game_id} from NBA API...")
    
    boxscore = safe_call_nba_api(
        name=f"BoxScoreTraditionalV3(game_id={game_id})",
        call_fn=lambda: boxscoretraditionalv3.BoxScoreTraditionalV3(game_id=game_id),
        max_retries=3,
        base_delay=3.0,
    )
    
    if boxscore is None:
        print(f"[game_player_stats_service] Failed to fetch boxscore for game {game_id} after retries.")
        return None
    
    # BoxScoreTraditionalV3 uses a new data structure
    data = boxscore.get_dict()
    box_score_data = data.get('boxScoreTraditional', {})
    
    if not box_score_data:
        print(f"[game_player_stats_service] No boxScoreTraditional data found for game {game_id}")
        print(f"[game_player_stats_service] This might mean the game hasn't started yet or the game_id is invalid.")
        return None, None
    
    # Extract player stats from homeTeam and awayTeam
    # Each team has a 'players' list, where each player has 'personId' and 'statistics'
    home_team = box_score_data.get('homeTeam', {})
    away_team = box_score_data.get('awayTeam', {})
    home_team_id = box_score_data.get('homeTeamId')
    away_team_id = box_score_data.get('awayTeamId')
    
    # Extract team scores from team statistics
    home_team_stats = home_team.get('statistics', {})
    away_team_stats = away_team.get('statistics', {})
    home_score = home_team_stats.get('points') if home_team_stats else None
    away_score = away_team_stats.get('points') if away_team_stats else None
    
    # Build game info dict for updating games table
    game_info = {
        'home_score': int(home_score) if home_score is not None else None,
        'away_score': int(away_score) if away_score is not None else None,
        'status': 'Final'  # If we have player stats, game is likely finished
    }
    
    home_players = home_team.get('players', [])
    away_players = away_team.get('players', [])
    
    # Combine both teams' player stats and add team_id
    all_player_stats = []
    
    # Process home team players
    for player in home_players:
        if player.get('statistics'):  # Only include players with stats
            player_stat = {
                'PLAYER_ID': player.get('personId'),
                'TEAM_ID': home_team_id,
                'statistics': player.get('statistics', {}),
            }
            all_player_stats.append(player_stat)
    
    # Process away team players
    for player in away_players:
        if player.get('statistics'):  # Only include players with stats
            player_stat = {
                'PLAYER_ID': player.get('personId'),
                'TEAM_ID': away_team_id,
                'statistics': player.get('statistics', {}),
            }
            all_player_stats.append(player_stat)
    
    if not all_player_stats or len(all_player_stats) == 0:
        print(f"[game_player_stats_service] Empty player stats data for game {game_id}")
        print(f"[game_player_stats_service] This usually means:")
        print(f"  - The game hasn't started yet (no player stats available)")
        print(f"  - The game_id format is incorrect")
        print(f"  - The game doesn't exist")
        print(f"[game_player_stats_service] Tip: Check if the game has started by running 'python cli.py games' first")
        return None, None
    
    print(f"Fetched {len(all_player_stats)} player stats from NBA API for game {game_id}")
    if home_score is not None and away_score is not None:
        print(f"  Game score: {away_score} - {home_score} (Away - Home)")
    
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
    fantasy_score = _calculate_fantasy_score(
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
