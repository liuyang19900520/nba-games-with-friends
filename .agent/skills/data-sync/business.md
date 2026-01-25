---
description: Business logic and data policies for Data Sync Service
service_path: services/data-sync
type: business
---

# Data Sync Business Logic

**Goal**: Accurate, idempotent synchronization of NBA data from official API to Supabase.

## 1. Task Logic (Task Queue Consumer)

The worker passively listens to `task_queue` (populated by n8n).

### A. `SYNC_LIVE_GAME`
-   **Trigger**: Inserted by n8n when a game is `Live` or `Scheduled`.
-   **Logic**:
    1.  Fetch fresh `Boxscore` and `PlayByPlay` from NBA API.
    2.  **Upsert** to Supabase.
    3.  **Critical Rule**: Must handle "0-0" bug (poll boxscore even if PBP is empty).
    4.  **Frequency**: Low latency (every 30s-1m during game).

### B. `DAILY_WRAP_UP`
-   **Trigger**: Inserted by n8n when ALL games are `Final`.
-   **Logic**:
    1.  Final Sync of all games.
    2.  **Betting Settlement**: Calculate results for user bets (if implemented).
    3.  Update "Game Status" to Final in DB.

## 2. Data Policies
-   **Idempotency**: Running a sync 100 times MUST result in the same state as running it once.
-   **Retention**: Keep historic data indefinitely (Supabase).
-   **Source of Truth**: NBA API is Master; Supabase is Slave (Cache).
