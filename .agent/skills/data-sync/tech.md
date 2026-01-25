---
description: Technical implementation details for Python Data Sync Worker
service_path: services/data-sync
tech_stack: [Python 3.10+, Docker, Supabase, NBA API]
type: tech
---

# Data Sync Technical Implementation

## 1. Stack
-   **Runtime**: Python 3.10+
-   **Database**: Supabase (via `supabase-py`).
-   **Deployment**: Docker (Production) or Local Python (Development).

## 2. Deployment Constraints
> [!IMPORTANT]
> **NBA API Blocking**: AWS Lightsail IPs are often blocked by NBA Stats API.
> -   **Production**: Runs in Docker, but often needs proxy or local runner.
> -   **Development**: Run LOCALLY (`worker.py`) to bypass IP blocks.

## 3. Code Standards
-   **Type Hints**: MANDATORY for all functions.
-   **Logging**: Use `logger`, NEVER `print`.
-   **Configuration**:
    -   Local: `.env.development`
    -   Prod: `.env.production`

## 4. Key Files
| File | Purpose |
|------|---------|
| `worker.py` | Main loop (polls `task_queue`) |
| `cli.py` | Manual overrides (`python cli.py sync_game <id>`) |
| `services/` | Logic isolation (keep `worker.py` clean) |

## 5. Troubleshooting (Tech)
1.  **"NBA API Timeout"**:
    -   You are likely blocked. Try `ping` to nba.com. Switch IP or use proxy.
2.  **"0-0 Score"**:
    -   Known bug. Ensure you are hitting the `v3` boxscore endpoint, not just `v1`.
3.  **Supabase Connection**:
    -   Check `.env` `SUPABASE_URL`. Ensure it is reachable.
