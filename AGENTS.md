# AGENTS.md

Instructions for coding agents (primarily Codex cloud) working in this repo.

## Purpose
NBA Game With Friends: a fantasy lineup / game prediction app. Next.js web frontend, Python data-sync and LangChain AI agent services, a Stripe payment function, and the infra to run them. Data lives in Supabase.

## Structure
| Path | What | Stack | Deploys to (per README) |
|---|---|---|---|
| `apps/web` | Frontend | Next.js 15, React, Supabase, Tailwind | Vercel |
| `services/data-sync` | Data ingestion worker | Python, Supabase | AWS (Lambda/EC2, docker-compose) |
| `services/ai-agent` | AI agent (`server.py`) | Python 3.11, LangChain/LangGraph | Railway / EC2 (TODO: confirm which) |
| `functions/payment` | Payment handler + SQL migrations | Node (`index.mjs`), Stripe | AWS Lambda |
| `infrastructure/` | `deploy.sh`, `n8n/`, `scripts/`, `terraform/` | Docker, Terraform | AWS |
| `memory/project/STATE.md` | Agent checkpoint for the AI-native refactor | | |

## Install / run / test / lint
- **apps/web** (Node 20, as in CI): `cd apps/web && npm ci && npm run dev` · build `npm run build` · lint `npm run lint`. No test script exists. Build needs `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- **services/ai-agent** (Python 3.11): `cd services/ai-agent && pip install -r requirements.txt && python server.py` (TODO: verify the run command). No test or lint setup is configured.
- **services/data-sync** (Python): `pip install -r requirements.txt`; entry points are `main.py`, `cli.py`, `worker.py`, `dev.sh`, and `docker-compose.yml`. The env template is `env.example`. `test_script.py` and `test_proxy.py` are ad-hoc scripts, not a test suite.
- **functions/payment**: `cd functions/payment && npm ci`. No test or lint scripts exist.
- CI (`.github/workflows/ci.yml`) only builds web and pip-installs ai-agent, and only when those paths changed in the last commit.

## Branch and PR rules
- `dev` is the default/integration branch and `main` is production.
- Work on `feature/*` or `codex/*` branches and open a PR into `dev`.
- **Never push directly to `dev` or `main`.** Do not merge PRs, delete branches, or change the default branch.
- `auto-pr-to-dev.yml` opens a PR to `dev` for any pushed branch other than main/dev automatically.
- Use Conventional Commits (`feat:`, `fix:`, `chore:` ...).

## Secrets
- Never commit secrets or `.env` files. Use `.env.example` / `env.example` as templates. Never print or alter GitHub secrets.

## Do NOT touch without explicit owner approval
- Deploy workflows: `.github/workflows/deploy-*.yml` (ai-agent, data-sync, payment)
- `infrastructure/` (terraform, deploy.sh, n8n, EC2/scheduler config)
- Payment logic and SQL migrations in `functions/payment`, and the credit deduction logic
- Production hosting config (Vercel, and the static hosting / maintenance page on `codex/*` branches)
- Do not run anything against production (deploys, migrations, terraform apply).

## Setup script for Codex cloud environment
Use Node 20 and Python 3.11. Builds that need Supabase require `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` set as Codex environment secrets. Never put them in the repo.
```bash
set -e
cd apps/web && npm ci && cd -
cd functions/payment && npm ci && cd -
python3 -m pip install --upgrade pip
pip install -r services/ai-agent/requirements.txt
pip install -r services/data-sync/requirements.txt
```
