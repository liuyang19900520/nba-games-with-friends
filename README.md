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
This is a **Polylith Workspace**. Each folder in `apps/` and `services/` is its own Git repository.

**To work on the Website:**
1. Open only the `apps/web` folder in your IDE.
2. Run `npm install` and `npm run dev`.
3. Commit and push changes from *inside* that folder.

**To work on the Data Sync:**
1. Open only the `services/data-sync` folder.
2. Run with Docker or Python directly.
3. Commit and push changes from *inside* that folder.

### AI Agents
Check `.agent/skills/SKILL.md` for global rules.
Each sub-project has its own `SKILL.md` for specific rules.
