"""
AWS Lambda handler for NBA data sync (dev environment).
This handler is used by the nba-sync-dev Lambda function to trigger the full sync.
"""
from typing import Any, Dict

from main import sync_all_data


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """AWS Lambda entrypoint.

    This function will:
    - Truncate all relevant tables in Supabase
    - Sync teams, team standings, players, and player season stats

    It is designed for the dev environment Lambda: nba-sync-dev.
    """
    print("[Lambda] Starting NBA data sync (dev)...")
    try:
        sync_all_data()
        print("[Lambda] NBA data sync completed successfully.")
        return {"status": "ok"}
    except Exception as e:
        print(f"[Lambda] Error during NBA data sync: {e}")
        # Let Lambda mark the invocation as failed
        raise
