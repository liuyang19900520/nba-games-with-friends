# NBA Game With Friends - Monorepo Workspace

This repository serves as the root workspace for the NBA Game With Friends project.
It contains infrastructure configuration and independent sub-projects.

## Structure

### 1. Applications (`apps/`)
- **[apps/web](./apps/web)**: Next.js Frontend.
  - *Independent Git Repository*.
  - Tech: Next.js, React, Supabase, Tailwind.

### 2. Services (`services/`)
- **[services/data-sync](./services/data-sync)**: Data Ingestion Worker.
  - *Independent Git Repository*.
  - Tech: Python, Docker, Supabase.
- **services/ai-agent**: (Planned) LangChain AI Agent.

### 3. Infrastructure (`infrastructure/`)
- **[infrastructure/n8n](./infrastructure/n8n)**: N8n workflow orchestration (Docker).
- **functions/payment**: (Planned) Serverless payment functions.

## Development Guide

### How to work on this project
This is a **Single Monorepo Workspace**. All code is tracked in one Git repository.

**To work on the Website:**
1. You can open the root folder `/` to see everything.
2. OR, you can open `apps/web` in your IDE to focus only on the frontend.
   - Note: Git commits will still be tracked by the root `.git` folder (VS Code handles this automatically).

**To work on the Data Sync:**
1. Open only the `services/data-sync` folder.
2. Run with Docker or Python directly.
3. Commit and push changes from *inside* that folder.

### AI Agents
Check `.agent/skills/SKILL.md` for global rules.
Each sub-project has its own `SKILL.md` for specific rules.
