# NBA v2 (redo) — ESPN data app, WeChat mini program + H5

> v1 is preserved at tag `legacy-v1` / branch `dev` (see LEGACY.md). This branch (`v2`) is the redo.

## Architecture
```
ESPN public APIs ──(sync/, scheduled Lambda)──▶ Postgres (Supabase; supabase/migrations)
                                                   │
                         api/ (AWS Lambda Function URL, JSON /api/v1, CORS)  ◀── also: static JSON snapshot (scripts/export-snapshot.ts)
                                                   │
app/ (Taro 4 + React + TS) ── one codebase ──▶ WeChat mini program (dist/weapp)
                                           └─▶ H5 (dist/h5, Vercel `nba-v2`; overseas, English default for non-zh browsers)
```
- Frontend modes (`app/.env.*`, `TARO_APP_API_MODE`): `mock` (bundled fake data, current default, no backend), `request` (HTTP API), `cloud` (WeChat cloud-function proxy).
- Images (team logos + headshots) are downloaded and served from our own static path `/img/...` (`app/scripts/localize-images.py`). They are ESPN-owned → non-commercial MVP only.

## Quick start
```bash
cd app && npm ci
npm run build:h5          # mock data, output app/dist/h5 (serve statically)
npm run build:weapp       # app/dist/weapp → open app/ in WeChat DevTools
# backend (optional): npm ci && npm run pglite & && npm run local   → http://127.0.0.1:8787
```
## CI/CD
- GitHub Actions `ci.yml`: on PRs and pushes to `v2` → typecheck, H5 build (mock), weapp compile, main package < 2MB, H5 artifact.
- Vercel project **nba-v2** (root `app/`): push to `v2` → production deploy; any other branch / PR → preview URL.
- Rule: verify the preview before merging to `v2`.

## Docs
`docs/API-CONTRACT.md` · `docs/backend.md` (API/Lambda/deploy/cost) · `docs/sync.md` · `docs/nba-v2-schema-final-test.md` · `docs/nba-espn-mapping.md` · `docs/nba-data-gap.md` · `docs/hupu-ui-notes.md` · `docs/hupu-vs-espn.md` · `app/README.md`
