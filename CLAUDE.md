# Claude Code Context - NBA Game With Friends

This file is the entry point for **Claude Code (CLI)**. It syncs with Antigravity via the shared `.agent/` directory.

## Quick Start

Before any task, load these skills in order:

1. **Global Rules**: `.agent/skills/global/rules.md`
2. **Service Rules** (based on working directory):
   - `apps/web/` → `.agent/skills/web/rules.md`
   - `services/data-sync/` → `.agent/skills/data-sync/rules.md`
   - `infrastructure/n8n/` → `.agent/skills/n8n/rules.md`
3. **Living Memory**: `.agent/memory/active_pdca.md`

## Project Overview

| Component | Path | Tech Stack |
|-----------|------|------------|
| Web App | `apps/web/` | Next.js 15, React, Supabase |
| Data Sync | `services/data-sync/` | Python, Docker |
| n8n | `infrastructure/n8n/` | n8n, Caddy, AWS Lightsail |

## Key Rules (Summary)

- **Language**: Code/Docs in English, Chat in Chinese
- **Git**: Conventional Commits (`feat:`, `fix:`, `docs:`)
- **Secrets**: Never hardcode, use `.env` files
- **PDCA**: Update `.agent/memory/active_pdca.md` after solving hard problems

## Infrastructure Quick Reference

| Resource | Value |
|----------|-------|
| n8n URL | `https://57.182.161.64.nip.io` |
| Lightsail SSH | `ssh -i ~/.ssh/LightsailDefaultKey-ap-northeast-1.pem ubuntu@57.182.161.64` |
| Supabase | `cihryhmlyihjvonkhrpp.supabase.co` |

## MCP Tools Available

- `mcp__filesystem__*` - File operations
- `mcp__n8n-mcp__*` - n8n workflow management
- `mcp__line-bot__*` - LINE notifications

## After Completing a Task

If you solved a difficult problem:
1. Add entry to `.agent/memory/active_pdca.md`
2. Add `> [!TIP]` to relevant `rules.md`
