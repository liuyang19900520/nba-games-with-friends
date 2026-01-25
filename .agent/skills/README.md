# NBA Game With Friends - AI Agent Skills Registry

This directory contains hierarchical skill definitions for AI agents (Claude Code, Antigravity, Cursor).

## Directory Structure

```
.agent/skills/
├── README.md           # This file - Skills index
├── global/             # Global rules (apply to ALL services)
│   └── rules.md
├── web/                # apps/web - Next.js Web Application
│   └── rules.md
├── data-sync/          # services/data-sync - Python Data Sync Worker
│   └── rules.md
├── n8n/                # infrastructure/n8n - Workflow Automation
│   └── rules.md
```

## Usage Protocol (Business vs Tech)

We separate **Business Logic** (volatile, replaces old requirements) from **Technical Knowledge** (accumulative, best practices).

### 1. File Structure
For each component (`n8n`, `data-sync`, `web`):
-   **`business.md`**: The **WHAT**.
    -   *Content*: Business rules, workflows, schedules, data policies, user-facing text.
    -   *Update Policy*: **REPLACE**. If requirements change (e.g., "Show 20 days"), overwrite the old rule.
-   **`tech.md`**: The **HOW**.
    -   *Content*: Stack details, commands, infrastructure, troubleshooting.
    -   *Update Policy*: **ACCUMULATE**. Add new tips, fix commands. Delete OLD tech only if architecture changes (e.g., Nginx removed).

### 2. For AI Agents
1.  **Start Task**: Read `business.md` to understand the goal.
2.  **Implementation**: Read `tech.md` to understand the tools and constraints.
3.  **PDCA Loop**:
    -   **Requirement Change?** → Update `business.md`.
    -   **Technical Fix/Lesson?** → Update `tech.md`.

## Quick Reference

| Service | Path | Docs |
|---------|------|------|
| Web App | `apps/web/` | `web/business.md`, `web/tech.md` |
| Data Sync | `services/data-sync/` | `data-sync/business.md`, `data-sync/tech.md` |
| n8n | `infrastructure/n8n/` | `n8n/business.md`, `n8n/tech.md` |
