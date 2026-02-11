# NBA Game With Friends - Project Context

This file provides context for AI assistants (Claude Code, Antigravity).

## Project Overview

| Component | Path | Tech Stack |
|-----------|------|------------|
| Web App | `apps/web/` | Next.js 15, React, Supabase |
| Data Sync | `services/data-sync/` | Python, Docker |
| AI Agent | `services/ai-agent/` | Python, LangChain v0.3, LangGraph |
| n8n | `infrastructure/n8n/` | n8n, Caddy, AWS Lightsail |

## Key Rules

- **Language**: Code/Docs in English, Chat in Chinese
- **Git**: Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `chore:`)
- **Secrets**: Never hardcode, use `.env` files

## Infrastructure Quick Reference

| Resource | Value |
|----------|-------|
| n8n URL | `https://57.182.161.64.nip.io` |
| Lightsail SSH | `ssh -i ~/.ssh/LightsailDefaultKey-ap-northeast-1.pem ubuntu@57.182.161.64` |
| Supabase | `cihryhmlyihjvonkhrpp.supabase.co` |

## Skills

AI skills are located in `.agent/skills/` (Antigravity) and `.claude/skills/` (Claude Code).
These are managed via `npx @anthropic-ai/skills`.
