"""
Utility functions for NBA data synchronization.
"""
import json
import os
from datetime import datetime
import time
from typing import Any, Callable, Dict, Optional

from requests import ConnectionError, HTTPError, ReadTimeout, Timeout


def get_current_nba_season() -> str:
    """
    Get the current NBA season based on the current date.
    
    NBA seasons typically start in October:
    - If current month >= 10, season is current_year - (current_year+1)
    - If current month < 10, season is (current_year-1) - current_year
    
    Returns:
        str: Season in format 'YYYY-YY' (e.g., '2024-25')
    """
    now = datetime.now()
    current_year = now.year
    current_month = now.month
    
    if current_month >= 10:
        # Season started this year, ends next year
        season = f"{current_year}-{str(current_year + 1)[-2:]}"
    else:
        # Season started last year, ends this year
        season = f"{current_year - 1}-{str(current_year)[-2:]}"
    
    return season


def safe_call_nba_api(
    name: str,
    call_fn: Callable[[], Any],
    max_retries: int = 3,
    base_delay: float = 3.0,
    post_success_sleep: float = 0.0,
) -> Optional[Any]:
    """
    Safely call an NBA API endpoint with retries, backoff and logging.

    Args:
        name: A human-readable name for logging (e.g. "LeagueStandings(2025-26)").
        call_fn: A callable that executes the NBA API request and returns the endpoint instance.
        max_retries: Maximum number of attempts.
        base_delay: Base delay (in seconds) between retries. Actual delay grows linearly as base_delay * attempt.
        post_success_sleep: Optional sleep (seconds) after a successful request for throttling.

    Returns:
        The result of call_fn() on success, or None if all retries fail.
    """
    attempt = 1
    last_error: Optional[Exception] = None

    while attempt <= max_retries:
        try:
            print(f"[nba_api] Calling {name} (attempt {attempt}/{max_retries})")
            result = call_fn()
            print(f"[nba_api] {name} succeeded on attempt {attempt}")

            if post_success_sleep > 0:
                print(
                    f"[nba_api] Sleeping {post_success_sleep}s after successful call "
                    f"to {name} for throttling"
                )
                time.sleep(post_success_sleep)

            return result

        except (ReadTimeout, Timeout, ConnectionError, HTTPError) as e:
            last_error = e
            print(
                f"[nba_api] {name} failed with {type(e).__name__} on "
                f"attempt {attempt}/{max_retries}: {e}"
            )
        except Exception as e:  # Catch-all to avoid crashing Lambda
            last_error = e
            print(
                f"[nba_api] {name} failed with unexpected {type(e).__name__} "
                f"on attempt {attempt}/{max_retries}: {e}"
            )
            # For unexpected errors, do not retry endlessly
            break

        # Decide whether to retry
        if attempt < max_retries:
            delay = base_delay * attempt
            print(f"[nba_api] Retrying {name} after {delay:.1f}s...")
            time.sleep(delay)
            attempt += 1
        else:
            break

    print(
        f"[nba_api] Giving up on {name} after {max_retries} attempts. "
        f"Last error: {last_error}"
    )
    return None


def load_fantasy_scoring_config(config_path: str = "fantasy-scoring.json") -> Dict[str, Any]:
    """
    Load fantasy scoring configuration from JSON file.
    
    Args:
        config_path: Path to the fantasy scoring JSON configuration file.
                    Defaults to "fantasy-scoring.json" in the project root.
    
    Returns:
        Dictionary containing the fantasy scoring configuration.
    
    Raises:
        FileNotFoundError: If the configuration file does not exist.
        json.JSONDecodeError: If the JSON file is invalid.
        ValueError: If the configuration structure is invalid.
    """
    # Get the project root directory (where this file is located)
    project_root = os.path.dirname(os.path.abspath(__file__))
    full_path = os.path.join(project_root, config_path)
    
    if not os.path.exists(full_path):
        raise FileNotFoundError(
            f"Fantasy scoring configuration file not found: {full_path}"
        )
    
    with open(full_path, 'r', encoding='utf-8') as f:
        config = json.load(f)
    
    # Validate configuration structure
    if 'rules' not in config:
        raise ValueError("Configuration file must contain 'rules' key")
    
    if 'calculation' not in config:
        raise ValueError("Configuration file must contain 'calculation' key")
    
    return config


def calculate_fantasy_score(
    pts: float,
    reb: float,
    ast: float,
    stl: float,
    blk: float,
    tov: float,
    config: Optional[Dict[str, Any]] = None,
) -> float:
    """
    Calculate fantasy score using rules from JSON configuration.
    
    Args:
        pts: Points scored
        reb: Rebounds
        ast: Assists
        stl: Steals
        blk: Blocks
        tov: Turnovers
        config: Optional fantasy scoring configuration dictionary.
                If not provided, loads from fantasy-scoring.json.
    
    Returns:
        Fantasy score rounded according to configuration (default: 2 decimal places).
        Minimum value is enforced according to configuration (default: 0).
    """
    # Load config if not provided
    if config is None:
        config = load_fantasy_scoring_config()
    
    rules = config.get('rules', {})
    calculation = config.get('calculation', {})
    
    # Build stat map for easy lookup
    stats_map = {
        'pts': pts,
        'reb': reb,
        'ast': ast,
        'stl': stl,
        'blk': blk,
        'tov': tov,
    }
    
    # Calculate fantasy score using coefficients from rules
    fantasy_score = 0.0
    for rule_name, rule_config in rules.items():
        stat_name = rule_config.get('stat')
        coefficient = rule_config.get('coefficient', 0.0)
        
        if stat_name in stats_map:
            stat_value = stats_map[stat_name]
            fantasy_score += stat_value * coefficient
    
    # Apply minimum value if configured
    minimum = calculation.get('minimum', 0)
    if fantasy_score < minimum:
        fantasy_score = minimum
    
    # Apply rounding if configured
    rounding_config = calculation.get('rounding', {})
    if rounding_config.get('enabled', True):
        decimals = rounding_config.get('decimals', 2)
        fantasy_score = round(fantasy_score, decimals)
    else:
        # Default to 1 decimal place for backward compatibility
        fantasy_score = round(fantasy_score, 1)
    
    return fantasy_score
