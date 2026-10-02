# Project State Snapshot (Agentic Harness)
<!-- Agent Checkpoint: This file must be updated during multi-stage work -->

## Meta
- **task_id:** ai-native-architecture-refactor
- **started:** 2026-03-01T22:50:00+09:00
- **last_checkpoint:** 2026-03-01T22:50:00+09:00
- **current_phase:** Phase 1 - Infrastructure & Memory

## Global Objective
Transform the legacy NBA Fantasy Lineup backend into an AI-Native Multi-Agent architecture guided by Eval-Driven Development and Context Asymmetry.

## Completed Tasks
- [x] Phase 1.1: Initialize new directory structure (`.agents/`, `memory/`)
- [x] Phase 1.2: Establish `AGENTS.md` global ruleset

## Current Phase Progress
- [x] Phase 1.3: Extract/organize existing scripts into skills (`.agents/skills/`)
- [x] Phase 1.4: Verify `STATE.md` recovery mechanism
- [x] Phase 2.1: Refactor single Agent to Supervisor/Router architecture in `fantasy_lineup.py`
      **STATUS: COMPLETED - Built `supervisor.py` to route atomic data fetching tasks.**
- [x] Phase 2.2: Define Explicit Agent Handoffs
      **STATUS: COMPLETED - Supervisor effectively maps loop across DataFetcher and Reviewer.**
- [ ] Phase 2.3: Data Tools vs Render Tools isolation
      **STATUS: IN_PROGRESS - Context Asymmetry.**
- [ ] Phase 3: Eval-Driven Checks
- [ ] Phase 4: UI Context Asymmetry (`data-llm` attributes)

## Known Issues / Action Items
- None yet.

## Recovery Instructions
If the agent crashes or exceeds token limits:
1. Reload this `STATE.md` file.
2. Read `task_id` and find the first unchecked item in "Current Phase Progress".
3. Verify test states and resume from that unchecked item.
## 2026-10-02 Production maintenance page

- Isolated checkout based on remote main so the unfinished serverless refactor branch stays independent.
- The custom domain currently presents a Let's Encrypt certificate that expired on 2026-09-26. The domain CNAME points at Vercel; HTML cannot repair TLS before the browser loads a page.
- Added a self-contained, dependency-free public/index.html and Vercel static output configuration. The page explains the friends' NBA game's serverless migration without promising a reopening date.
- User requested English; all page copy and accessibility labels now use English.
- Next: validate desktop/mobile rendering and routing, then publish only the maintenance change and check certificate/domain status.
