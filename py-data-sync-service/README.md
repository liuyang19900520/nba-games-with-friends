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


## CI/CD: Deploy to AWS Lambda (dev)

This project is wired for automatic deployment to an existing AWS Lambda function for the **dev** environment.

- Lambda function name: `nba-sync-dev`
- Region: `ap-northeast-1`
- Runtime: **Python 3.14** (Lambda) – this workflow uses Python 3.14 in CI to match.
- Handler (Lambda configuration): `handler.handler` (module `handler.py`, function `handler`)

### How the dev deployment works

1. You modify code under `py-data-sync-service/` (this project directory in the monorepo).
2. You commit and push to the **`dev`** branch.
3. GitHub Actions workflow `.github/workflows/deploy-dev-py-data-sync.yml` runs and will:
   - Install dependencies into `py-data-sync-service/build/` using `requirements.txt`.
   - Copy all Python source files (including `handler.py`, `main.py`, `config.py`, `db.py`, `utils.py`, `services/`) into `build/`.
   - Create `py-data-sync-service/package.zip` from the `build/` directory.
   - Call `aws lambda update-function-code` to deploy `package.zip` to the existing `nba-sync-dev` Lambda.

### Required GitHub Secrets

These Secrets must be configured in the **monorepo (nba-games-with-friends)** GitHub repository:

- `AWS_ACCESS_KEY_ID` – IAM user access key with permission to update Lambda code.
- `AWS_SECRET_ACCESS_KEY` – corresponding secret key.
- `AWS_REGION` – should be set to `ap-northeast-1`.

> Note: The IAM user should follow least-privilege principle. It needs permission for at least:
> - `lambda:UpdateFunctionCode` on the `nba-sync-dev` function.
> - (Optionally) `lambda:GetFunction` for diagnostics.

### Lambda environment variables (dev)

The Lambda **already** has environment variables configured for the Supabase **dev** environment, e.g.:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY` (if needed)
- `SUPABASE_SERVICE_ROLE_KEY`
- `ENVIRONMENT=development`

The CI/CD pipeline **does not** set these values – they must be managed via the AWS Lambda console or IaC (CloudFormation/Terraform) separately.

### How to test end-to-end

1. Ensure AWS Lambda function `nba-sync-dev` exists in `ap-northeast-1` and is configured with:
   - Runtime: Python 3.14
   - Handler: `handler.handler`
   - Proper environment variables for Supabase dev.

2. In GitHub (monorepo):
   - Edit any file under `py-data-sync-service/`.
   - Commit to the `dev` branch and push.

3. In GitHub Actions:
   - Open the **Actions** tab.
   - Find the workflow named **"Deploy py-data-sync-service to dev Lambda"**.
   - Confirm the latest run on branch `dev` is **green**.

4. In AWS Lambda Console:
   - Open the `nba-sync-dev` function.
   - Use the **Test** button to invoke the function.
   - Check **CloudWatch Logs** for output from `handler.handler` / `sync_all_data()` to verify the latest code is running.

If you later want a PROD pipeline, you can copy
`.github/workflows/deploy-dev-py-data-sync.yml`, change:

- The trigger branch (e.g., `main`),
- The function name (e.g., `nba-sync-prod`),
- And the environment variables in the target Lambda (PROD Supabase config).
