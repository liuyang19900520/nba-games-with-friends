---
description: Global development guidelines and project structure content.
---

# Global Project Skills & Guidelines

This project is a **Single Monorepo**. All code is in one Git repository.
- **Root**: `/Users/lijiao/nba-game-with-friends`
- **Apps**: `apps/` (User Facing, e.g., Next.js)
- **Services**: `services/` (Backend workers, e.g., Python Data Sync)
- **Infrastructure**: `infrastructure/` (n8n, Docker, AWS)

## Documentation Language
- **ALL Documentation, Comments, and Commit Messages MUST be in ENGLISH.**
    - No Chinese comments allowed in code (e.g., `// TODO: ...`).
    - No Chinese in configuration files (`.env`, `yaml`).
- **Conversations with the User (Chat) MUST be in Simplified Chinese (简体中文).**

## General Conventions
- **Git**: Use Conventional Commits (e.g., `feat: login page`, `fix: token error`).
- **Secrets**: NEVER hardcode secrets or IPs. Use `.env` variables.
    - **Naming Standard**: Use `.env.development` for local development and `.env.production` for production.
- **Pathing**: Always use ABSOLUTE PATHS when using tools.
- **Independence**: Each folder in `apps/` and `services/` is designed to be opened as a standalone root.

## Architecture & Code Quality
1. **DRY (Don't Repeat Yourself)**: Extract reusable logic into `utils` or `lib`.
2. **KISS (Keep It Simple, Stupid)**: Avoid over-engineering. If a simple script works, don't build a complex framework.
3. **Comments**: Write "Why", not "What". The code explains "What".
    - **BAD**: `i = i + 1 // Increment i`
    - **GOOD**: `retry_count += 1 // Exponential backoff trigger`

## Git Workflow
- **Branching**: Use feature branches. Do not commit directly to `main` (unless hotfix).
    - Format: `feat/user-profile`, `fix/login-bug`.
- **Commits**: Conventional Commits is MANDATORY.
    - `feat:` New features.
    - `fix:` Bug fixes.
    - `docs:` Documentation changes.
    - `refactor:` Code change that neither fixes a bug nor adds a feature.
    - `chore:` Build process, auxiliary tools.

## PDCA Protocol (Continuous Improvement)
**Mandatory for all AI Agents:**

1.  **Plan**: Read `SKILL.md` before starting.
2.  **Do**: Execute the task.
3.  **Check**:
    - Did you encounter a complex bug?
    - Did you struggle with a specific configuration?
4.  **Act (Update Skills)**:
    - If yes, **YOU MUST** record the "Pitfall" and "Solution" in the relevant `SKILL.md`.
    - Format: `> [!TIP] Lesson Learned: [Context] - [Solution]`
    - This saves tokens and time for the next agent.


## Deployment & Infrastructure (CRITICAL)

### Architecture Overview
The system is split into two environments to avoid IP blocking issues:
1.  **Local Environment (macOS)**: Runs the **Python Data Sync Worker**.
    -   **Why?**: The AWS Lightsail IP is blocked/throttled by the NBA API (`stats.nba.com`).
    -   **Responsibility**: Execute `worker.py` to sync data to Supabase.
    -   **Trigger**: Polls `task_queue` table in Supabase.
2.  **Remote Environment (AWS Lightsail)**: Runs **n8n**.
    -   **Why?**: Hosting long-running workflows and webhooks.
    -   **Responsibility**: Insert tasks into Supabase `task_queue`.
    -   **Access**: Use `deploy.sh` to update n8n configuration ONLY.

### Deployment Rules
> [!WARNING]
> **DO NOT DEPLOY THE PYTHON WORKER TO LIGHTSAIL.**
-   The worker must run LOCALLY on the user's machine (Docker: `nba-worker-dev`).
-   `deploy.sh` is solely for deploying n8n configuration to the remote server.

### Remote Access
-   **Host**: `57.182.161.64`
-   **User**: `ubuntu`
-   **Key**: `~/infrastructure/deploy.sh` handles auth automatically.

## AI Agent Behavior
- **Context**: Always check the local `SKILL.md` of the directory you are working in.
- **Proactive**: If you see a missing configuration (e.g., `.vscode/launch.json`), propose creating it.
