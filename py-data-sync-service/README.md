# NBA Data Sync Service

Python service to sync NBA data from NBA API to Supabase database.

## Features

- Syncs teams, team standings, players, and player season statistics
- Supports development and production environments
- Automatic table truncation before sync to ensure fresh data
- Current season detection

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Configure environment:
   - Copy `.env.development` for development (already configured)
   - Copy `.env.production` for production and update with production credentials

3. Set environment variable (optional, defaults to development):
```bash
export ENVIRONMENT=development  # or production
```

## Usage

### Sync all data

```bash
python3 main.py
```

This will:
1. Truncate all tables (teams, team_standings, players, player_season_stats)
2. Sync teams
3. Sync team standings
4. Sync players
5. Sync player season stats

### Sync individual tables

```python
from services import sync_teams, sync_team_standings, sync_active_players, sync_player_season_stats

sync_teams()
sync_team_standings()
sync_active_players()
sync_player_season_stats()
```

## Environment Configuration

- `.env.development` - Development environment (local)
- `.env.production` - Production environment

Both files contain:
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (required for data sync)

## Project Structure

```
.
├── main.py                 # Main entry point
├── config.py               # Configuration management
├── db.py                   # Supabase client
├── utils.py                # Utility functions
├── services/               # Sync services
│   ├── team_service.py
│   ├── team_standings_service.py
│   ├── player_service.py
│   └── stats_service.py
└── requirements.txt        # Python dependencies
```

