# NBA Game With Friends - Monorepo Workspace

This repository serves as the root workspace for the NBA Game With Friends project.
It contains infrastructure configuration and independent sub-projects.

## Structure

### 1. Applications (`apps/`)
- **[apps/web](./apps/web)**: Next.js Frontend.
  - Tech: Next.js 15, React, Supabase, Tailwind.
  - Deployment: Vercel.

### 2. Services (`services/`)
- **[services/data-sync](./services/data-sync)**: Data Ingestion Worker.
  - Tech: Python, Supabase.
  - Deployment: AWS Lambda (Sync functions).
- **[services/ai-agent](./services/ai-agent)**: LangChain AI Agent.
  - Tech: Python, LangChain v0.3, LangGraph.
  - Deployment: Railway.

### 3. Functions & Infra
- **[functions/payment](./functions/payment)**: Node.js serverless payment handler (Stripe).
  - Deployment: AWS Lambda.
- **[infrastructure/n8n](./infrastructure/n8n)**: n8n workflow orchestration (Docker).
  - Deployment: AWS Lightsail/Railway.

## Environment & Deployment

We follow a two-tier environment strategy:

| Environment | Branch | Deployment | Purpose |
|-------------|--------|------------|---------|
| **Local** | N/A | Localhost | Development & Debugging |
| **Preview** | `dev` | AWS (dev) / Railway (dev) | Integration testing with Prod keys |
| **Production**| `main` | AWS (prod) / Railway (prod)| Live production environment |

### CI/CD Workflows
- Check `.github/workflows/` for automated deployment logic.
- Web: Auto-deployed via Vercel integration.
- Services: GitHub Actions for AWS Lambda and Railway.

## Development Guide

This is a **Monorepo Workspace**. All code is tracked in one Git repository.

1. **Local Setup**: Copy `.env.example` to `.env` in respective folders.
2. **Commit Policy**: Follow Conventional Commits (`feat:`, `fix:`, etc.).
3. **Environment**: Use `dev` branch for pushing to the preview environment.

>>>>>>> dev
