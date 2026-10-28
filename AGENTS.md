# AGENTS.md (v2)
- **Branches**: `dev` = default branch, holds v1 (do not change it from v2 work). **`v2` is the integration branch during the redo.** Work on short-lived branches off `v2`, open PRs into `v2`.
- **Rule (Yang)**: a change must be verified on its **Vercel preview** before it is merged/promoted to production. Never merge without that.
- Never force-push `v2`/`dev`, never delete branches/tags (`legacy-v1` preserves v1), never commit secrets (`DATABASE_URL` etc. live only in env/secret stores).
- Layout: `app/` Taro frontend (weapp + H5) · `api/` Lambda handlers · `sync/` ESPN sync · `supabase/migrations/` · `infra/` SAM · `scripts/` snapshot export · `local/` local runner/PGlite · `docs/`.
- No fantasy points/scoring anywhere. ESPN is the only data source. API contract: `docs/API-CONTRACT.md` (additive changes only).
- CI: `.github/workflows/ci.yml` (typecheck, H5 mock build, weapp compile + 2MB main-package check). Vercel project `nba-v2` deploys `app/` (prod branch `v2`, previews for other branches/PRs).
