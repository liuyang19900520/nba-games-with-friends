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

## Validation & Verification (MANDATORY)
**All AI Agents (Antigravity & Claude Code) MUST verify their work.**

1.  **Verification Step**: After completing a task (especially logical fixes or data syncs), you must RUN a verification step.
    -   *Example*: If you fixed a worker, check the logs or DB to confirm it processed data.
    -   *Example*: If you fixed a UI component, verify it renders without error (if possible) or check the data flow.
2.  **Report Failures**: If verification fails, explicitly state the cause.
3.  **Human Verification**: For UI changes or complex logic, it is acceptable to ask the user to verify, but you must provide clear instructions on *what* to look for.

## Validation & Verification (MANDATORY)
**All AI Agents (Antigravity & Claude Code) MUST verify their work.**

1.  **Verification Step**: After completing a task (especially logical fixes or data syncs), you must RUN a verification step.
    -   *Example*: If you fixed a worker, check the logs or DB to confirm it processed data.
    -   *Example*: If you fixed a UI component, verify it renders without error (if possible) or check the data flow.
2.  **Report Failures**: If verification fails, explicitly state the cause.
3.  **Human Verification**: For UI changes or complex logic, it is acceptable to ask the user to verify, but you must provide clear instructions on *what* to look for.







## Skills Hierarchy (Refactored)

```
.agent/
├── skills/
│   ├── README.md        # Index & Protocol
│   ├── global/          # Global rules
│   │   └── rules.md
│   ├── web/             # Apps/Web
│   │   ├── business.md  # Requirements & Features
│   │   └── tech.md      # Implementation & Stack
│   ├── data-sync/       # Services
│   │   ├── business.md
│   │   └── tech.md
│   └── n8n/             # Infrastructure
│       ├── business.md
│       └── tech.md
└── memory/
    └── active_pdca.md   # Pitfalls & Solutions
```

## PDCA Protocol (The Infinite Loop)
**We separate Business (What) from Technology (How).**

### 1. Plan (Read)
-   **Understand the Goal**: Read `business.md`.
-   **Understand the Tools**: Read `tech.md`.
-   **Check Pitfalls**: Read `.agent/memory/active_pdca.md`.

### 2. Do (Execute)
-   Implement changes.

### 3. Check (Verify)
-   **Requirement Changed?** (e.g. "Show 20 days instead of 10")
-   **New Trick Learned?** (e.g. "Use this specific flag for Caddy")

### 4. Act (Update Skills)
-   **Update Business**: If requirements changed, **OVERWRITE** `business.md`.
-   **Update Tech**: If you learned a better way, **APPEND** to `tech.md`.
-   **Update Memory**: If you solved a hard bug, update `active_pdca.md`.


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

## Lessons Learned (Global)

> [!TIP]
> **AWS Lightsail Firewall**: After creating a new instance, ALWAYS verify ports 80 and 443 are open. Use `aws lightsail get-instance --instance-name NAME` to check `networking.ports`.

> [!TIP]
> **Skills Sync Between Agents**: Claude Code and Antigravity share context via `.agent/` directory. Always update `.agent/memory/active_pdca.md` after solving hard problems.

> [!TIP]
> **Configuration Source of Truth**: Each infrastructure component has ONE correct config directory. For n8n, it's `infrastructure/n8n/aws/`. Legacy configs in parent directories should be ignored.
