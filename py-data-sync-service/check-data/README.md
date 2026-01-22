# NBA Data Check & Repair Tools

This folder contains utilities for auditing and repairing NBA database data.

**All times are displayed in Tokyo Time (JST, UTC+9).**

## Scripts

| Script | Description |
|--------|-------------|
| `audit_data.py` | Quick health check - teams, schedule, game integrity, stats coverage |
| `deep_audit.py` | Comprehensive audit of all tables with freshness indicators |
| `backfill_data.py` | Batch repair tool with checkpoint/resume support |

## ⚠️ NBA API Rate Limiting

**IMPORTANT:** The NBA API enforces rate limits (~20-30 requests per minute).

The backfill script includes:
- Conservative delays between API calls (2.5-4.0 seconds)
- Random jitter to avoid detection patterns
- Automatic checkpoint/resume if interrupted

**If you encounter 429 (Too Many Requests) errors:**
1. Wait 5-10 minutes before resuming
2. Increase the delay constants in `backfill_data.py`:
   - `DELAY_BETWEEN_DATES_MIN`: Try 4.0
   - `DELAY_BETWEEN_DATES_MAX`: Try 6.0
   - `DELAY_BETWEEN_GAMES_MIN`: Try 3.0
   - `DELAY_BETWEEN_GAMES_MAX`: Try 5.0

## Usage

**All commands should be run from the `py-data-sync-service` directory:**

```bash
cd py-data-sync-service
```

### 1. Quick Audit
```bash
python check-data/audit_data.py
```

### 2. Deep Audit (All Tables)
```bash
python check-data/deep_audit.py
```

### 3. Backfill / Repair Data

```bash
# Check what needs to be synced (dry run)
python check-data/backfill_data.py --check

# Run Phase 1: Sync games + player stats
# Estimated time: ~30-60 min depending on missing data
python check-data/backfill_data.py --phase1

# Run Phase 2: Sync season aggregates (~5 min)
python check-data/backfill_data.py --phase2

# Run all phases
python check-data/backfill_data.py --all

# Resume from checkpoint (if interrupted or rate limited)
python check-data/backfill_data.py --resume

# Clear checkpoint and start fresh
python check-data/backfill_data.py --clear
```

## Data Sync Order

```
Phase 1 (Game-level data):
├── games (scores, status)
├── game_player_stats (box scores)
└── game_player_advanced_stats (advanced metrics)

Phase 2 (Aggregate data):
├── player_season_stats
├── player_season_advanced_stats
├── team_standings
└── team_season_advanced_stats
```

## Checkpoint System

The backfill script saves progress to `backfill_checkpoint.json`:
- Automatically resumes from last position if interrupted
- Tracks completed dates, games, and phases
- Use `--clear` to reset and start fresh
- **Tip:** If rate limited, just wait and run `--resume`

## Timezone

All audit reports display timestamps in **Tokyo Time (JST, UTC+9)**.
