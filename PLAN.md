# PLAN.md

## Current state (from repo, 2026-10-27)
- `dev` head: `96441c3 fix: add credit deduction to lineup API & protect API Gateway URL`. Recent work covered Vercel deployment, payment/credits, 1-click lineup (SSE), and AI hub date logic.
- `memory/project/STATE.md` (AI-native refactor): Phase 2.3 (data vs render tool isolation) is IN_PROGRESS. Phase 3 (eval-driven checks) and Phase 4 (UI `data-llm` attributes) are not started. STATE.md says `AGENTS.md` and `.agents/skills/` were created, but neither exists on `dev` (TODO: find out where they went).
- Remote dev: Codex cloud (see AGENTS.md setup section).
- Unmerged branches: `codex/refactor-v2`, `codex/production-maintenance`, `codex/restore-production-hosting` (static production hosting / maintenance page), and `feature_one_click` (TODO: check whether it is already merged via PR #3).
- 12 Dependabot PRs are open (apps/web and functions/payment npm deps).
- CI covers only web build and ai-agent install. There are no automated tests or Python lint.

## Next steps
- [ ] Review and triage the 12 Dependabot PRs
- [ ] Decide what to do with the `codex/*` branches (owner decision; production-related)
- [ ] Reconcile STATE.md with the repo (missing AGENTS.md history and `.agents/`)
- [ ] Finish Phase 2.3, then Phase 3 evals and Phase 4
- [ ] Add a minimal test/lint setup: web tests, ruff/pytest for Python services, and include data-sync and payment in CI
- [ ] Add a root `.env.example` listing the required variable names
- [ ] TODO: confirm the actual ai-agent hosting (README says Railway; workflows/infra mention EC2)
