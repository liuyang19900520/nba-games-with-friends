"""
Game player advanced statistics synchronization service.
Fetches player advanced stats for a specific game from NBA API 
and syncs to Supabase game_player_advanced_stats table.

API: BoxScoreAdvancedV3
Table: game_player_advanced_stats
Unique constraint: (game_id, player_id)
"""
from typing import Dict, List, Optional, Set
import pandas as pd
from nba_api.stats.endpoints import boxscoreadvancedv3
from db import get_db
from utils import safe_call_nba_api


def _safe_int(value, default: int = 0) -> int:
    """Safely convert value to int."""
    if pd.isna(value) or value is None or value == '':
        return default
    try:
        return int(float(value))
    except (ValueError, TypeError):
        return default


def _safe_float(value) -> Optional[float]:
    """Safely convert value to float, returning None for invalid values."""
    if pd.isna(value) or value is None or value == '':
        return None
    try:
        return float(value)
    except (ValueError, TypeError):
        return None


def _fetch_game_advanced_stats(game_id: str) -> Optional[Dict]:
    """
    Fetch advanced stats for a game from NBA API.
    
    Args:
        game_id: NBA game ID (e.g., '0022500540')
    
    Returns:
        Dict with boxScoreAdvanced data, or None if fetch failed
    """
    print(f"Fetching advanced stats for game {game_id} from NBA API...")
    
    result = safe_call_nba_api(
        name=f"BoxScoreAdvancedV3(game_id={game_id})",
        call_fn=lambda: boxscoreadvancedv3.BoxScoreAdvancedV3(game_id=game_id),
        max_retries=30,
        base_delay=3.0,
    )
    
    if result is None:
        print(f"[game_player_advanced_stats_service] Failed to fetch after retries.")
        return None
    
    data = result.get_dict()
    return data.get('boxScoreAdvanced')


def _transform_player_advanced_stats(
    player: Dict,
    game_id: str,
    team_id: int,
    valid_player_ids: Set[int],
    valid_team_ids: Set[int]
) -> Optional[Dict]:
    """
    Transform NBA API player advanced stats to database format.
    
    Args:
        player: Player dict from BoxScoreAdvancedV3 response
        game_id: NBA game ID
        team_id: Team ID the player belongs to
        valid_player_ids: Set of valid player IDs from database
        valid_team_ids: Set of valid team IDs from database
    
    Returns:
        Dict with transformed stats, or None if player should be skipped
    """
    player_id = _safe_int(player.get('personId', 0))
    if player_id == 0:
        return None
    
    # Skip players not in players table (foreign key constraint)
    if player_id not in valid_player_ids:
        return None
    
    # Validate team_id
    if team_id not in valid_team_ids:
        team_id = None
    
    # Get statistics object
    stats = player.get('statistics', {})
    if not stats:
        return None
    
    # Map API fields to database columns
    stats_data = {
        'game_id': str(game_id),
        'player_id': player_id,
        'team_id': team_id,
        'off_rating': _safe_float(stats.get('offensiveRating')),
        'def_rating': _safe_float(stats.get('defensiveRating')),
        'net_rating': _safe_float(stats.get('netRating')),
        'ast_pct': _safe_float(stats.get('assistPercentage')),
        'ast_to': _safe_float(stats.get('assistToTurnover')),
        'oreb_pct': _safe_float(stats.get('offensiveReboundPercentage')),
        'dreb_pct': _safe_float(stats.get('defensiveReboundPercentage')),
        'reb_pct': _safe_float(stats.get('reboundPercentage')),
        'tm_tov_pct': _safe_float(stats.get('turnoverRatio')),
        'efg_pct': _safe_float(stats.get('effectiveFieldGoalPercentage')),
        'ts_pct': _safe_float(stats.get('trueShootingPercentage')),
        'usg_pct': _safe_float(stats.get('usagePercentage')),
        'pace': _safe_float(stats.get('pace')),
        'pie': _safe_float(stats.get('PIE')),
    }
    
    return stats_data


def sync_game_player_advanced_stats(game_id: str) -> None:
    """
    Sync player advanced statistics for a specific game from NBA API 
    to Supabase game_player_advanced_stats table.
    
    Fetches BoxScoreAdvancedV3 and extracts for each player:
    - game_id, player_id, team_id
    - off_rating, def_rating, net_rating
    - ast_pct, ast_to
    - oreb_pct, dreb_pct, reb_pct
    - tm_tov_pct, efg_pct, ts_pct
    - usg_pct, pace, pie
    
    Args:
        game_id: NBA game ID (e.g., '0022500540')
    """
    try:
        print(f"Starting game player advanced stats sync for game {game_id}...")
        
        # Get Supabase client
        supabase = get_db()
        
        # Get valid player IDs from database (for FK validation)
        print("Fetching valid player IDs from players table...")
        players_result = supabase.table('players').select('id').execute()
        valid_player_ids = set(player['id'] for player in players_result.data)
        print(f"Found {len(valid_player_ids)} valid players in database")
        
        # Get valid team IDs from database (for FK validation)
        print("Fetching valid team IDs from teams table...")
        teams_result = supabase.table('teams').select('id').execute()
        valid_team_ids = set(team['id'] for team in teams_result.data)
        print(f"Found {len(valid_team_ids)} valid teams in database")
        
        # Fetch data from NBA API
        box_score = _fetch_game_advanced_stats(game_id)
        if box_score is None:
            print(f"⚠️ Failed to fetch advanced stats for game {game_id}. Skipping.")
            return
        
        # Extract players from both teams
        home_team = box_score.get('homeTeam', {})
        away_team = box_score.get('awayTeam', {})
        
        home_team_id = _safe_int(home_team.get('teamId', 0))
        away_team_id = _safe_int(away_team.get('teamId', 0))
        
        home_players = home_team.get('players', [])
        away_players = away_team.get('players', [])
        
        print(f"Found {len(home_players)} home players and {len(away_players)} away players")
        
        # Transform all players
        stats_data: List[Dict] = []
        skipped_count = 0
        
        # Process home team players
        for player in home_players:
            transformed = _transform_player_advanced_stats(
                player, game_id, home_team_id, valid_player_ids, valid_team_ids
            )
            if transformed:
                stats_data.append(transformed)
            else:
                skipped_count += 1
        
        # Process away team players
        for player in away_players:
            transformed = _transform_player_advanced_stats(
                player, game_id, away_team_id, valid_player_ids, valid_team_ids
            )
            if transformed:
                stats_data.append(transformed)
            else:
                skipped_count += 1
        
        if skipped_count > 0:
            print(f"Skipped {skipped_count} players (not in players table or missing stats)")
        
        print(f"Transformed {len(stats_data)} player advanced stats records")
        
        # Upsert to Supabase
        if stats_data:
            print(f"Syncing {len(stats_data)} player advanced stats to Supabase...")
            
            synced_count = 0
            failed_count = 0
            
            try:
                # Bulk upsert with composite key (game_id, player_id)
                result = supabase.table('game_player_advanced_stats').upsert(
                    stats_data,
                    on_conflict='game_id,player_id'
                ).execute()
                
                synced_count = len(stats_data)
                print(f"✅ Successfully synced advanced stats for {synced_count} players")
                
            except Exception as upsert_error:
                # If bulk upsert fails, try one by one
                print(f"⚠️ Bulk upsert failed ({upsert_error}), trying individual upserts...")
                
                for stat in stats_data:
                    try:
                        supabase.table('game_player_advanced_stats').upsert(
                            stat,
                            on_conflict='game_id,player_id'
                        ).execute()
                        synced_count += 1
                    except Exception as e:
                        failed_count += 1
                        if failed_count <= 3:
                            print(f"  ❌ Failed to upsert stats for player {stat['player_id']}: {e}")
                
                if synced_count > 0:
                    print(f"✅ Successfully synced {synced_count}/{len(stats_data)} player advanced stats")
                else:
                    raise Exception(f"Failed to sync any player advanced stats: {upsert_error}")
            
            if failed_count > 0:
                print(f"⚠️ Failed to sync {failed_count} player records")
        else:
            print("ℹ️ No valid player advanced stats to sync")
        
        # Verify data insertion
        print("\nVerifying data insertion...")
        verify_result = supabase.table('game_player_advanced_stats').select(
            'player_id, team_id, off_rating, def_rating, net_rating, usg_pct, pie'
        ).eq('game_id', game_id).order('net_rating', desc=True).limit(5).execute()
        
        if verify_result.data:
            print(f"✅ Verification successful! Found advanced stats for game {game_id}")
            print("Top 5 players by Net Rating:")
            for stat in verify_result.data:
                off = stat['off_rating'] or 0
                defr = stat['def_rating'] or 0
                net = stat['net_rating'] or 0
                usg = stat['usg_pct'] or 0
                pie = stat['pie'] or 0
                print(
                    f"  - Player {stat['player_id']}: "
                    f"OFF {off:.1f}, DEF {defr:.1f}, NET {net:.1f}, "
                    f"USG% {usg:.3f}, PIE {pie:.3f}"
                )
        else:
            print("⚠️ Warning: No player advanced stats found in database after insertion")
        
        print(f"\n✅ Game player advanced stats sync completed for game {game_id}!")
        
    except Exception as e:
        print(f"\n❌ Error during game player advanced stats sync: {str(e)}")
        import traceback
        traceback.print_exc()
        raise
