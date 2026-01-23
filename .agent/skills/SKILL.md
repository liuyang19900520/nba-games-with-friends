---
description: Global development guidelines and project structure content.
---

# Global Project Skills & Guidelines

This project uses a Monorepo structure with standalone modules.
- **Root**: `/Users/lijiao/nba-game-with-friends`
- **Apps**: `apps/` (User Facing, e.g., Next.js)
- **Services**: `services/` (Backend workers, e.g., Python Data Sync)
- **Infrastructure**: `infrastructure/` (n8n, Docker, AWS)

## Documentation Language
- **ALL Documentation, Comments, and Commit Messages MUST be in ENGLISH.**
- **Conversations with the User (Chat) MUST be in Simplified Chinese (简体中文).**

## General Conventions
- **Git**: Use Conventional Commits (e.g., `feat: login page`, `fix: token error`).
- **Pathing**: Always use ABSOLUTE PATHS when using tools.
- **Independence**: Each folder in `apps/` and `services/` is designed to be opened as a standalone root. When working inside `apps/web`, treat it as the root of the React application.

## AI Agent Behavior
- **Context**: Always check the local `SKILL.md` of the directory you are working in.
- **Proactive**: If you see a missing configuration (e.g., `.vscode/launch.json`), propose creating it.
