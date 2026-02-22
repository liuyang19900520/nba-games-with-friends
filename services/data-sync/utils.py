"""
Utility functions for NBA data synchronization.

Includes:
- Season calculation
- Safe NBA API calls with rate limiting
- Fantasy score calculation
- Structured logging (SyncLogger)
"""
import json
import os
import random
import sys
from datetime import datetime
import time
from typing import Any, Callable, Dict, List, Optional

import pytz
from requests import ConnectionError, HTTPError, ReadTimeout, Timeout

# ============================================================================
# TIMEZONE CONFIGURATION
# ============================================================================
TOKYO_TZ = pytz.timezone('Asia/Tokyo')


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


def _restore_nba_proxy(
    proxy_url: Optional[str],
    old_https: Optional[str],
    old_http: Optional[str],
    old_nba_proxy: Optional[str] = None,
) -> None:
    """Restore nba_api proxy and env vars after a stats.nba.com call."""
    if not proxy_url:
        return
    import nba_api.library.http as _nba_http
    _nba_http.PROXY = old_nba_proxy if old_nba_proxy is not None else ""


def safe_call_nba_api(
    name: str,
    call_fn: Callable[[], Any],
    max_retries: int = 5,
    base_delay: float = 5.0,
    post_success_sleep: float = 0.5,
) -> Optional[Any]:
    """
    Safely call an NBA API endpoint with retries, exponential backoff and rate limit handling.

    IMPORTANT: NBA API enforces rate limits (~20-30 req/min).
    This function includes:
    - Exponential backoff on failures
    - Extended delays for rate limit errors (RemoteDisconnected, 429)
    - Post-success sleep to avoid triggering limits
    - Optional proxy via NBA_STATS_PROXY env var (only applied to nba_api calls)
    - Per-attempt proxy rotation: each retry picks a fresh {n} session and new TCP session

    Args:
        name: A human-readable name for logging (e.g. "LeagueStandings(2025-26)").
        call_fn: A callable that executes the NBA API request and returns the endpoint instance.
        max_retries: Maximum number of attempts (default: 5).
        base_delay: Base delay (in seconds) between retries (default: 5.0).
                   Actual delay grows exponentially: base_delay * (2 ^ attempt).
        post_success_sleep: Sleep (seconds) after successful request for throttling (default: 0.5).

    Returns:
        The result of call_fn() on success, or None if all retries fail.
    """
    import requests as _requests
    from http.client import RemoteDisconnected

    proxy_url_template = os.environ.get('NBA_STATS_PROXY')

    # Save original nba_api proxy so we can restore after the call
    _old_nba_proxy: Optional[str] = None
    _old_session = None
    if proxy_url_template:
        import nba_api.library.http as _nba_http
        _old_nba_proxy = _nba_http.PROXY
        _old_session = _nba_http.NBAHTTP._session

    def _apply_proxy() -> None:
        """Build a new session with proxy injected into nba_api.
        For rotating proxies each new session gets a fresh IP automatically."""
        if not proxy_url_template:
            return
        import nba_api.library.http as _nba_http
        from nba_api.stats.library.http import NBAStatsHTTP as _NBAStatsHTTP
        # Build a fresh session with proxy pre-configured on the session itself
        session = _requests.Session()
        session.proxies = {'http': proxy_url_template, 'https': proxy_url_template}
        _nba_http.PROXY = proxy_url_template  # used by send_api_request for per-request proxies arg
        # IMPORTANT: must set on the SUBCLASS (NBAStatsHTTP), not base NBAHTTP.
        # After NBAStatsHTTP.get_session() is called once, it creates its own _session
        # class attribute that shadows NBAHTTP._session.
        _NBAStatsHTTP._session = session
        _nba_http.NBAHTTP._session = session  # also set base class for safety
        print(f"[nba_api] Using proxy: {proxy_url_template.split('@')[-1]}")

    def _restore_proxy() -> None:
        if proxy_url_template is None:
            return
        import nba_api.library.http as _nba_http
        from nba_api.stats.library.http import NBAStatsHTTP as _NBAStatsHTTP
        _nba_http.PROXY = _old_nba_proxy if _old_nba_proxy is not None else ""
        _NBAStatsHTTP._session = _old_session
        _nba_http.NBAHTTP._session = _old_session

    attempt = 1
    last_error: Optional[Exception] = None
    rate_limited = False
    # Track whether the last failure was a proxy-level issue (not server-side rate limit)
    proxy_failure = False

    while attempt <= max_retries:
        # Apply a fresh proxy (next IP in cycle + new session) on every attempt
        _apply_proxy()

        try:
            print(f"[nba_api] Calling {name} (attempt {attempt}/{max_retries})")
            result = call_fn()
            print(f"[nba_api] {name} succeeded on attempt {attempt}")

            if post_success_sleep > 0:
                sleep_time = post_success_sleep + random.uniform(0, 0.5)
                time.sleep(sleep_time)

            _restore_proxy()
            return result

        except (ReadTimeout, Timeout) as e:
            last_error = e
            print(
                f"[nba_api] {name} failed with {type(e).__name__} on "
                f"attempt {attempt}/{max_retries}: {e}"
            )
            if proxy_url_template:
                # Timeout through proxy = this IP is blocked/slow by nba.com → rotate quickly
                proxy_failure = True
                print(f"[nba_api] ⚠️ Proxy IP blocked/slow — will rotate to next IP")
            else:
                rate_limited = True

        except ConnectionError as e:
            last_error = e
            error_str = str(e)
            print(
                f"[nba_api] {name} failed with ConnectionError on "
                f"attempt {attempt}/{max_retries}: {e}"
            )
            if ('ProxyError' in error_str or 'Unable to connect to proxy' in error_str
                    or 'Tunnel connection failed' in error_str or 'SSLError' in error_str
                    or 'RemoteDisconnected' in error_str or 'Connection aborted' in error_str):
                # All connection-level failures: proxy issue — rotate IP, minimal delay
                proxy_failure = True
                print(f"[nba_api] ⚠️ Proxy/connection failed — will rotate IP on next attempt")

        except HTTPError as e:
            last_error = e
            print(
                f"[nba_api] {name} failed with HTTPError on "
                f"attempt {attempt}/{max_retries}: {e}"
            )
            if hasattr(e, 'response') and e.response is not None:
                if e.response.status_code == 429:
                    print(f"[nba_api] ⚠️ Rate limit (429) detected!")
                    rate_limited = True

        except Exception as e:
            last_error = e
            error_str = str(e)
            print(
                f"[nba_api] {name} failed with unexpected {type(e).__name__} "
                f"on attempt {attempt}/{max_retries}: {e}"
            )
            if ('ProxyError' in error_str or 'Unable to connect to proxy' in error_str
                    or 'SSLError' in error_str or 'SSL' in type(e).__name__
                    or 'Tunnel connection failed' in error_str):
                proxy_failure = True
                print(f"[nba_api] ⚠️ Proxy/SSL connection failed — will rotate IP on next attempt")
            elif 'RemoteDisconnected' in error_str or '429' in error_str:
                rate_limited = True
            else:
                if isinstance(e, AttributeError) and "'NoneType' object has no attribute 'get'" in error_str:
                    print(f"[nba_api] ⚠️ Known nba_api error (empty response?) - retrying")
                else:
                    break

        if attempt < max_retries:
            if proxy_failure:
                # Rotating proxy: wait 3-8s so the proxy pool assigns a truly fresh IP
                delay = 3.0 + random.uniform(0, 5)
                proxy_failure = False  # reset for next attempt
            else:
                # Cap exponential backoff at 30s — longer waits don't help for NBA API
                delay = min(base_delay * (2 ** (attempt - 1)), 30.0)
                if rate_limited:
                    extra_delay = 30 + random.uniform(0, 30)
                    delay += extra_delay
                    print(f"[nba_api] ⚠️ Rate limited - adding extra {extra_delay:.1f}s delay")
                delay += random.uniform(0, 3)
            print(f"[nba_api] Retrying {name} after {delay:.1f}s...")
            time.sleep(delay)
            attempt += 1
        else:
            break

    print(
        f"[nba_api] Giving up on {name} after {max_retries} attempts. "
        f"Last error: {last_error}"
    )
    _restore_proxy()
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


# ============================================================================
# SYNC LOGGER
# ============================================================================

class SyncLogger:
    """
    Structured logger for sync operations.
    
    Supports two output modes:
    - JSON mode: Machine-readable JSON format for log extraction
    - Standard mode: Human-readable format for console output
    
    All timestamps use Tokyo time (JST).
    """
    
    def __init__(self, json_mode: bool = False):
        """
        Initialize logger.
        
        Args:
            json_mode: If True, output logs in JSON format. Otherwise, use human-readable format.
        """
        self.json_mode = json_mode
        self.logs: List[Dict[str, Any]] = []
        self.command: Optional[str] = None
        self.start_time: Optional[datetime] = None
        
        # Determine log file path
        # Assume we are in services/data-sync or project root
        self.log_file = "sync_2026.log"
        if os.path.exists("services/data-sync"):
            self.log_file = "services/data-sync/sync_2026.log"
    
    def set_command(self, command: str) -> None:
        """Set the current command name."""
        self.command = command
        self.start_time = datetime.now(TOKYO_TZ)
        self._log("SYNC", f"Starting {command}", command=command)
    
    def _log(self, level: str, message: str, **kwargs) -> None:
        """
        Internal method to log a message.
        
        Args:
            level: Log level (INFO, SUCCESS, ERROR, WARNING, SYNC)
            message: Log message
            **kwargs: Additional fields to include in log entry
        """
        now = datetime.now(TOKYO_TZ)
        timestamp = now.isoformat()
        local_time = now.strftime("%Y-%m-%d %H:%M:%S JST")
        
        log_entry = {
            "timestamp": timestamp,
            "level": level,
            "message": message,
            **kwargs
        }
        
        # Add command if set
        if self.command:
            log_entry["command"] = self.command
        
        # Store log entry
        self.logs.append(log_entry)
        
        log_line = ""
        if self.json_mode:
            # JSON output mode
            log_line = json.dumps(log_entry, ensure_ascii=False)
            print(log_line)
        else:
            # Human-readable output mode
            log_line = f"[{local_time}] [{level}] {message}"
            print(log_line)
            # Print additional fields if present (non-JSON mode)
            if kwargs:
                for key, value in kwargs.items():
                    if key not in ["command", "timestamp"]:
                        extra_line = f"  {key}: {value}"
                        print(extra_line)
                        log_line += f"\n{extra_line}"
        
        # Append to log file
        try:
            with open(self.log_file, "a", encoding="utf-8") as f:
                f.write(log_line + "\n")
        except Exception:
            pass # Fail silently if cannot write to file
    
    def info(self, message: str, **kwargs) -> None:
        """Log an info message."""
        self._log("INFO", message, **kwargs)
    
    def success(self, message: str, **kwargs) -> None:
        """Log a success message."""
        self._log("SUCCESS", message, **kwargs)
    
    def error(self, message: str, **kwargs) -> None:
        """Log an error message."""
        self._log("ERROR", message, **kwargs)
    
    def warning(self, message: str, **kwargs) -> None:
        """Log a warning message."""
        self._log("WARNING", message, **kwargs)
    
    def debug(self, message: str, **kwargs) -> None:
        """Log a debug message."""
        self._log("DEBUG", message, **kwargs)
    
    def complete(self, status: str = "success", **kwargs) -> None:
        """
        Log command completion.
        
        Args:
            status: Completion status (success, failed, etc.)
            **kwargs: Additional fields (records_synced, duration_seconds, etc.)
        """
        duration = None
        if self.start_time:
            duration = (datetime.now(TOKYO_TZ) - self.start_time).total_seconds()
            kwargs["duration_seconds"] = round(duration, 2)
        
        if status == "success":
            self.success(f"Completed {self.command}", **kwargs)
        else:
            self.error(f"Failed {self.command}", status=status, **kwargs)
    
    def get_summary(self) -> Dict[str, Any]:
        """
        Get summary of all logs for the current command.
        
        Returns:
            Dictionary with summary information
        """
        if not self.command:
            return {}
        
        duration = None
        if self.start_time:
            duration = (datetime.now(TOKYO_TZ) - self.start_time).total_seconds()
        
        # Extract key information from logs
        errors = [log for log in self.logs if log.get("level") == "ERROR"]
        warnings = [log for log in self.logs if log.get("level") == "WARNING"]
        success_logs = [log for log in self.logs if log.get("level") == "SUCCESS"]
        
        # Try to extract records_synced from success logs
        records_synced = None
        for log in success_logs:
            if "records_synced" in log:
                records_synced = log["records_synced"]
                break
        
        return {
            "command": self.command,
            "status": "success" if not errors else "failed",
            "duration_seconds": round(duration, 2) if duration else None,
            "records_synced": records_synced,
            "error_count": len(errors),
            "warning_count": len(warnings),
            "errors": [log.get("message") for log in errors]
        }
