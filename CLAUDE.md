# NBA Game With Friends - Project Context

This file provides context for AI assistants (Claude Code, Antigravity).

## Project Overview

| Component | Path | Tech Stack |
|-----------|------|------------|
| Web App | `apps/web/` | Next.js 15, React, Supabase |
| Data Sync | `services/data-sync/` | Python, Docker |
| AI Agent | `services/ai-agent/` | Python, LangChain v0.3, LangGraph |
| n8n | `infrastructure/n8n/` | n8n, Caddy, AWS Lightsail |

## Environment & Deployment Strategy

| Environment | Branch | Deployment Target | Key Usage |
|-------------|--------|-------------------|-----------|
| **Local** | N/A | Localhost / Docker | `.env.local` / `.env` |
| **Product-Preview**| `dev` | AWS Lambda (dev) / Railway (dev) | Production Keys |
| **Production** | `main` | AWS Lambda (prod) / Railway (prod) | Production Keys |

### Deployment Workflows

1. **Web App**: Managed by Vercel (Auto-deploys `dev` as preview, `main` as prod).
2. **Data Sync (Python)**: `.github/workflows/deploy-*-py-data-sync.yml` -> AWS Lambda.
3. **Payment (Node.js)**: `.github/workflows/deploy-*-payment.yml` -> AWS Lambda.
4. **AI Agent (Python)**: `.github/workflows/deploy-ai-agent.yml` -> Railway.
5. **n8n**: Local editing + Git-managed JSON. Manual/Auto import to production instance.

## Key Rules

- **Language**: Code/Docs in English, Chat in Chinese
- **Git**: Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `chore:`)
- **Secrets**: Never hardcode, use `.env` files

## Infrastructure Quick Reference

| Resource | Dev/Prod Target | URL / Info |
|----------|-----------------|------------|
| n8n | Prod-only | `https://57.182.161.64.nip.io` |
| Web | Preview | `*-git-dev-*.vercel.app` |
| Web | Prod | `your-domain.com` |
| Supabase | Shared/Prod | `cihryhmlyihjvonkhrpp.supabase.co` |
| AI Agent | Dev | `ai-agent-dev.railway.app` |
| AI Agent | Prod | `ai-agent-prod.railway.app` |


## Skills

AI skills are located in `.agent/skills/` (Antigravity) and `.claude/skills/` (Claude Code).
These are managed via `npx @anthropic-ai/skills`.
