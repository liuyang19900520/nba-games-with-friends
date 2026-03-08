# NBA Game with Friends - Project Deployment Architecture

This document defines the deployment environment separation and architecture rules for the NBA Game project. Any AI agent (like Antigravity, Cursor, etc.) modifying CI/CD workflows, infrastructure scripts, or environment configurations MUST adhere to these rules.

## Core Services
1. `nextjs` (Frontend Web App)
2. `ai-agent` (FastAPI Python backend)
3. `n8n` (Workflow Automation)
4. `data-sync` (Python Worker)
5. `payment` (AWS Lambda)

## 1. Local Development (Branches: `dev`, `feature/*`)
When code is running locally for testing:
*   **nextjs frontend:** Runs on `localhost:3000` (`npm run dev`)
*   **ai-agent:** Runs on `localhost:8000` (via Uvicorn)
*   **n8n:** Connects to the live remote AWS Lightsail instance.
*   **data-sync worker:** Runs in local Docker container.
*   **payment lambda:** Connects to the live remote AWS Lambda instance.

## 2. Dev Environment (Branch `dev` - Push or Merge)
Triggered via GitHub Actions when pushing/merging to `dev`:
*   **nextjs frontend:** Vercel Preview Deployment.
*   **ai-agent:** Deploys to AWS EC2, running on port **8000** (`ai-agent-dev` systemd service).
*   **n8n:** Uses the shared live AWS Lightsail instance.
*   **data-sync worker:** Deploys to AWS EC2 as a container. (Shares the single EC2 app environment).
*   **payment lambda:** Deploys to the shared remote AWS Lambda instance (`nba-payment`).

## 3. Main Environment (Branch `main` - Push or Merge)
Triggered via GitHub Actions when pushing/merging to `main`:
*   **nextjs frontend:** Vercel Production Deployment.
*   **ai-agent:** Deploys to AWS EC2, running on port **8001** (`ai-agent-main` systemd service).
*   **n8n:** Uses the shared live AWS Lightsail instance.
*   **data-sync worker:** Deploys to AWS EC2 as a container. (Shares the single EC2 app environment).
*   **payment lambda:** Deploys to the shared remote AWS Lambda instance (`nba-payment`).

## Workflow Directives
*   Feature branches should ALWAYS target `dev` for Pull Requests.
*   `ci.yml` matrix must test both `main` and `dev` environments.
*   Deploy scripts pointing to EC2 (`deploy-ai-agent.sh`, `deploy-data-sync.sh`) dynamically read the branch name as the first argument (`$1`) to parse which port mapping and internal folders to checkout natively on the VM.
