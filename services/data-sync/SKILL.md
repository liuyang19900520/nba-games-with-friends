---
description: Development guidelines for the Python Data Sync Service.
---

# Data Sync Service Skills (services/data-sync)

**Tech Stack**: Python 3.10+, Docker, Supabase (Postgres).

## Global Context (Standalone)
- **Language**: Doc/Comments in English. Chat in Simplified Chinese (简体中文).
- **Environment**: Use `.env.development` (Local) vs `.env.production`.
- **Secrets**: No hardcoded secrets.

## Role
- This service acts as a **Worker**.
- It is triggered by **n8n** (or cron) to fetch data from external APIs (NBA API) and sync it to Supabase.
- It does NOT serve a public HTTP API for the frontend (the frontend connects directly to Supabase).

## Rules & Best Practices

### 1. Python & Code Quality
- **Typing**: Strict Type Hints are MANDATORY for all function arguments and return values.
    - `def process_data(data: dict) -> list[int]:`
- **Linting**: Follow `Black` formatting style.
- **Logging**: Use `logging` module. NO `print()`.
    - Log levels: `INFO` for normal ops, `WARNING` for retries, `ERROR` for failures.

### 2. Data Engineering (Idempotency)
- **Idempotency**: All sync scripts MUST be idempotent.
    - Running the script 100 times should have the same result as running it once.
    - Use `UPSERT` operations instead of `INSERT`.
    - Truncate > Insert pattern is acceptable for full refreshes (Reference: `truncate_tables`).

### 3. Database Interactions
- **Client**: Use Supabase Python Client (`supabase-py`).
- **Batching**: When inserting large datasets (e.g., stats), use batch inserts to check performance.
- **Connections**: Reuse the Supabase client instance (`get_db()`) to manage connection pooling implicitly.

### 4. Docker & Deployment
- **Stateless**: The worker container should be stateless. All data persists to Supabase.
- **Environment**: Configuration strictly via Environment Variables (`config.py`).
- **Restart Policy**: Containers should handle crashes gracefully (`restart: always` in `infrastructure`).

## Debugging
- **Local Run**: `./dev.sh` to run the worker in Docker (Simulates Prop).
- **Manual Trigger**: `python main.py` for direct execution.

## Lessons Learned (Auto-Generated)
> [!TIP]
> Agents: Append new difficult bugs/solutions here.
