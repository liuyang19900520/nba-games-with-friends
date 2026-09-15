# Project State Snapshot (Agentic Harness)
<!-- Agent Checkpoint: This file must be updated during multi-stage work -->

## Meta
- **task_id:** cost-minimization-refactor
- **started:** 2026-09-04T21:10:00+09:00
- **last_checkpoint:** 2026-09-10T00:00:00+09:00
- **current_phase:** Serverless Architecture Audit - Design Review

## Global Objective
Thoroughly inspect the current project state and architecture, identify all cost drivers, and formulate a comprehensive refactoring strategy aimed at minimizing operational and infrastructure costs to near-zero while preserving 100% of existing functionality.

## Completed Tasks
- [x] Phase 0.1: Monorepo full-stack architecture deep inspection (`apps/web`, `services/ai-agent`, `services/data-sync`, `functions/payment`, `infrastructure/n8n`, `infrastructure/terraform`)
- [x] Phase 0.2: Infrastructure cost & operational overhead mapping (EC2, Elastic IP, Lightsail, Secrets Manager, CloudWatch/SNS, API Gateway, Supabase, Vercel)
- [x] Phase 0.3: Identification of architecture redundancies & cost optimization opportunities
- [x] Phase 0.4: Confirmed Supabase status (Confirmed PAUSED with DNS NXDOMAIN)
- [x] Phase 0.5: Drafted Comprehensive 100% Serverless Refactoring Plan (`implementation_plan.md`)

## Current Phase Progress
- [x] Phase 1.0: User Review & Approval of Implementation Plan
- [x] Phase 2.0: Execution - Payment Migration into Next.js (`/api/payment/create-session`, `/api/payment/webhook`)
- [x] Phase 3.0: Execution - 1-Click Lineup De-proxying into Next.js (`/api/lineup/generate`)
- [x] Phase 4.0: Execution - AI Prediction Migration (TypeScript + DeepSeek in Next.js `/api/predict`)
- [x] Phase 5.0: Execution - Data-Sync & Automation with GitHub Actions (`.github/workflows/nba-data-sync.yml`)
- [x] Phase 6.0: Local Verification & Service Testing (COMPLETED)
  - Supabase database confirmed 100% ONLINE and responsive (all 30 teams and games accessible).
  - Native Serverless AI Prediction (`/api/predict`, Tavily + DeepSeek) verified with actual model inference.
  - 1-Click Lineup direct query (`/api/lineup/generate`) verified with real player fantasy stats.
  - Native Stripe Payment route (`/api/payment/create-session`) verified with Stripe test API checkout session creation.
  - Full Next.js production build (`npm run build`) succeeded with exit code 0.
- [/] Phase 7.0: Vercel Production Deployment & Legacy AWS Resource Teardown (READY FOR APPROVAL)

## Known Issues / Observations
1. **Supabase Status**: Successfully restored and operational. Both anon and service_role keys function as expected.
2. **Local Environment Synced**: `apps/web/.env.development` successfully loaded with Stripe secrets from AWS Secrets Manager for local testing.
3. **AWS Legacy Resources Ready for Destruction**: EC2 ($15/mo), Lightsail ($3.50/mo), and Secrets Manager ($0.50/mo) are no longer serving traffic and can be safely terminated via Terraform.

## 2026-09-10 Serverless Architecture Audit Checkpoint

- [x] Re-audited the repository, live Supabase schema/data visibility, actual AWS resources, remote GitHub workflows, known deployment URLs, production build, and production dependency audit.
- [x] Added `docs/serverless-architecture-design.zh-CN.md` with the recommended Cloudflare Workers + Supabase + Cloud Run Jobs target, cost model, AI workflows, security blockers, and phased migration plan.
- [!] Do not run the current Terraform configuration: its local state has substantial drift and an apply could recreate deleted legacy AWS resources.
- [!] Production cutover is not complete: known application URLs are unavailable and the new `nba-data-sync.yml` exists only as an untracked local file.
- [!] P0 blockers exist in payment session authentication, credit RPC permissions/atomicity, anonymous `users` visibility, production dependency vulnerabilities, and leaked historical configuration.
- [x] Business decisions received: personal non-commercial showcase, Stripe Test Mode, manual refresh with approximately 15-minute freshness acceptable, unrestricted five-player lineups, friends leaderboard in MVP, lineup generation consumes credit, and Supabase Free preferred.
- [x] Architecture design revised to v2: Vercel Hobby + Supabase Free + on-demand GitHub Actions is the zero-fixed-cost baseline; Cloud Run Jobs is an optional usage-based fallback only.
- [ ] Next implementation phase should start with P0 payment/RLS/dependency fixes, followed by the admin refresh job protocol. No cloud teardown is authorized yet.

## Recovery Instructions
If the agent crashes or exceeds token limits:
1. Reload this `STATE.md` file.
2. Read `task_id` and resume from the current phase.

## 2026-09-13 Unified Web Implementation

- Branch: `codex/refactor-v2`, based on release tag `v1.0.0`.
- Scope authorized: consolidate frontend, AI and test-payment entry points inside `apps/web`; minimal Vercel + Supabase configuration. Existing hybrid deployment rules are superseded for these web paths by the user's serverless request.
- Existing source/package changes backed up to `/tmp/nba-web-unification-20260913.G7ObBE` before overlapping edits.
- Implementing: same-origin APIs, shared stream handling, server-side credit transactions, default no-model demo and optional bounded LLM mode; local test checkout and optional Stripe test checkout; remove AWS logging dependencies from web.
- Verification will use offline API/SQL tests, TypeScript and production build. Hosted database changes and production deployment are separate from this local implementation.
- Environment steering: local preview + main-branch production only. Sports data is shared; v2 wallets, runs and top-ups are partitioned by environment. Legacy lineup writes from localhost require an explicitly allowlisted test account. Migration is additive and leaves v1 tables/RPCs intact.
- Core web integration is in place; starting type checks, offline tests, and localhost preview before final verification.
- Local preview is running at http://localhost:3000/home with explicit demo AI/payment modes. Existing credentials are preserved; no paid model calls or cloud mutations performed.
- Added local/production environment design, example variables, main-only Vercel deployment config and real Web CI checks. Removed the obsolete automatic PR-to-dev workflow (recoverable in git).
- First offline run: 21 tests passed. Build verification found an auth redirect lint issue and hook dependencies, now fixed; expanding evidence/model regression tests before the final run.
- Hosted migration, OAuth/Stripe dashboard configuration and production deployment remain unperformed. Old v1 data permissions/atomic lineup writes remain separate release blockers.
- Final verification: 28 offline tests pass (4 files), ESLint and TypeScript pass, production build passes. Repeated typecheck/tests/build in `/tmp/nba-web-ci.xzGVLS` without any `.env` files or existing `.next` output; all pass. Remaining build notices concern the pre-existing ESLint plugin detection and old Browserslist dataset.
- Browser verified the local home and `/lineup?date=2026-06-14` player preview. Home clearly labels Local preview; historical-date submission is disabled. Dev server remains running on port 3000.
- Read-only hosted check confirms development/production Supabase URLs match, latest stored completed game is 2026-06-14, and v2 wallet table is absent (PGRST205). No hosted SQL, login account changes, checkout/model calls, commit, push, merge or deployment performed by this turn.
- Delivery: `docs/local-production-environments.zh-CN.md`, `apps/web/README.md`, `.env.example`, migration and CI/Vercel config. Before release: apply the additive SQL, configure hosted Auth/deployment settings, and resolve legacy security blockers. Source consolidation is not proof of a finished production cutover.

## 2026-09-12 Learning-First Planning Checkpoint

- [x] Added `docs/nba-ai-learning-practicum.zh-CN.md`: a 160-hour, seven-stage learning plan tied to the existing NBA codebase, with deliverables, evaluation gates, cost controls, and optional local/ephemeral infrastructure labs.
- [x] Revised the long-term roadmap in the separate robotlife repository at `010-Knowledge/011-IT/00-技术路线.md`; assumed four study hours per week pending user clarification.
- [x] Per robotlife's existing sync policy, committed only that roadmap as `6948ef6` and verified it is on `origin/main`. Four pre-existing user-edited/untracked files there remain byte-identical to the pre-task backup.
- [x] Corrected this project's architecture material: the 60-second request budget is a project choice, not the current Fluid Compute Hobby maximum; Supabase Free pause behavior and unverified proxy billing are explicit.
- [!] This turn changes documentation only. Earlier deployment, security, database, and AWS statements are historical observations, not newly verified live state. No implementation, paid resource creation, cloud teardown, or NBA repository push was performed.
- [ ] The first implementation learning block remains a reproducible fixture and security baseline, followed by transactional credits and bounded manual refresh. Completion of the plan is not completion of these features.
