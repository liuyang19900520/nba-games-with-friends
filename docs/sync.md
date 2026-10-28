# nba-sync (v2b) — ESPN → Postgres

`npx tsx src/sync.ts [flags]` (or `run(args)` from code / Lambda). Idempotent upserts (no-op when unchanged), polite (site 1 req/s, core 0.6 s/req, backoff), on-disk cache `ESPN_CACHE_DIR`.
| flag | effect |
|---|---|
| `--full` | teams+venues, rosters (bio, salary, coaches), standings, injuries, team stats, team schedules, all games `--from` (default 2026-10-02) → tomorrow (scoreboard + summary), Wikidata zh names, core bios (draft) + core season stats for every player for `--season` (2027) and `--prev-season` (2026). ~22 min cold. |
| (default daily) | rosters, standings, injuries, last `--days-back` (3) days → `--ahead` (1) scoreboards + summaries, core stats for players who played |
| `--games-only` | skip teams/rosters (frequent in-game runs) |
| `--schedule` `--team-stats` `--zh-names` | add those steps to a daily run |
| `--dates=YYYYMMDD,...` | explicit days · `--players=id,..` core bio/stats for given players · `--no-core` · `--no-bios` · `--reprocess` (re-parse cached summaries) |

Local: `npx tsx src/pglite-server.ts &` (PGlite :5433, up to 8 connections) → `npx tsx src/load-schema.ts local-shim.sql ../migrations/*.sql` → sync. `npx tsx src/sql.ts "select ..."` for ad-hoc SQL. Schema test: `node schema-test.mjs`. Run log: RUN-LOG.md.

# nba-sync — ESPN → Postgres (nba-games-with-friends v2)

TypeScript (Node 20 + `pg`): same language as the Next.js app and ports almost 1:1 to a Supabase Edge Function (Deno) or a GitHub Actions cron job.

## Files
- `src/espn.ts` — polite fetcher: User-Agent, ≥1 s between requests, 5 tries w/ exponential backoff (429/5xx/empty body), disk cache (`ESPN_CACHE_DIR`, default `/workspace/work/espn-cache`; final games & past days cached forever, rosters 12 h, today 10 min).
- `src/sync.ts` — teams, rosters (+contracts/salary history, player_team_history), scoreboard by US/Eastern date, summary box scores → `espn_raw` (jsonb, url, sha256, fetched_at) + core tables via `ON CONFLICT` upserts (ESPN ids are the PKs). No fantasy scoring (removed 2026-10-28); season averages come from view player_season_averages.
- `src/load-schema.ts` — apply .sql files; `src/q.ts` — ad-hoc query; `counts.sql` — row counts.
- `src/pglite-server.ts`, `local-shim.sql` — LOCAL ONLY (PGlite + fake `auth` schema/roles). Never run the shim on Supabase.

## Run
```bash
npm ci
export DATABASE_URL='postgres://...'           # never commit; use env/secret store
npx tsx src/load-schema.ts ../migrations/*.sql   # Supabase: use `supabase db push` instead
npx tsx src/sync.ts --full                      # teams + 30 rosters + last 3 game days + today + tomorrow
npx tsx src/sync.ts                             # daily incremental (scoreboards + box scores)
# options: --dates=20261025,20261026  --days-back=3  --ahead=1  --today=2026-10-28  --season=2027
```
Local: `npx tsx src/pglite-server.ts &` then `DATABASE_URL=postgres://postgres@127.0.0.1:5433/postgres`, load `local-shim.sql` + migrations.

## Supabase
Only `DATABASE_URL` (pooler/direct connection string of a role that bypasses RLS, e.g. `postgres`) + migrations applied. In GitHub Actions put it in a repo secret; the cache dir can be `actions/cache` or just disabled (`ESPN_CACHE_DIR=/tmp/x`) — raw payloads are in `espn_raw` anyway.
