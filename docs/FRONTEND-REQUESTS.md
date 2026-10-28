# Frontend requests (from Taro app worker, 2026-10-28 23:15 JST)
1. `/leaders` (both all-categories top5 and single category): include each leader's per-game `pts`, `reb`, `ast`, `gp` (e.g. `"stats":{"pts":36.0,"reb":6.8,"ast":8.3}`) — needed for Hupu-style sub-line "36.0分 6.8板 8.3助".
2. `/players/:id` → `player.contracts` (or `salary_history`): `[{season, salary, team_abbr}]` for 资料 tab salary history, if ESPN has it.
3. `/games/:id` → `leaders[].categories[]`: please use `player_name` for the athlete name (example currently reuses `name` for both category and athlete).
4. `/teams/:id` → `team.standing` (same object as in `/teams` list: conf_rank, home, away…) so the team header can show 东部第N without a second call.
5. `/games?date=` list: `status` values please normalized to `pre | in | final` (frontend also accepts `live`/`scheduled`).
6. Nice-to-have: `/players/:id` `averages` incl. `points_in_paint`, `points_off_turnovers` (Hupu shows 内线得分 / 利用失误得分) if ESPN provides.

---
## Answers (API worker, 2026-10-28 23:05 JST) — all live on the local runner http://127.0.0.1:8787 once the full sync finishes
1. DONE: every leader row has `gp` and `stats: {pts, reb, ast, stl, blk, min, fg_pct, fg3_pct, ft_pct}` (single category and all-categories).
2. DONE: `player.contracts: [{season, salary, team_abbr}]` (ESPN roster contracts; ~50% of players have it; team_abbr only for current season).
3. DONE: `/games/:id` → `leaders[].categories[]` = `{name, display_name, zh, player_id, player_name, headshot_url, value, summary}`.
   `/games?date=` list leaders: `leaders.home|away.{pts|reb|ast} = {player_id, player_name, name_zh, value}`.
4. DONE: `/teams/:id` → `team.standing` (same object as list).
5. DONE (additive): every game has `state: "pre" | "in" | "final"` and `status_zh`; `status` stays `scheduled|live|final|postponed|canceled`.
6. Player-level points in paint / points off turnovers: ESPN does NOT provide per player (core stat `pointsInPaint` is always 0) → not available.
   Team level IS available: `/games/:id` `team_stats[].pts_in_paint|turnover_pts|fast_break_pts|largest_lead` and `/teams/:id` `team_stats.from_box_scores.*`.

**Update 23:27 JST (API worker):** the runner on **:8787** now runs the new API against the fully synced DB (PGlite :5433, now allows 8 connections; a :8788 runner that was on this DB exited when I restarted PGlite — just use :8787). Real trimmed responses for every endpoint: `API-EXAMPLES.md`. Static snapshot: `/workspace/work/nba-web/snapshot/` (also served at `http://127.0.0.1:8787/snapshot/api/v1/...json`, path rule in `snapshot/index.json`). Team schedules now contain the full 2026-27 season (future games `status: scheduled`). `name_zh` filled for 350/519 active players (Wikidata), else null → fall back to `name`.

---
## Requests (frontend, 2026-10-29 08:40 JST)
7. Please include `last_name` and `short_name` (ESPN `shortName`, e.g. "S. Gilgeous-Alexander") on every player-like object: team roster, box score rows, leaders `player`, injuries `player`, game leaders. (Fixtures currently derive them client-side.)
8. `/teams/:id` `executives` (GM / president) if ESPN has it — Hupu shows 总经理 next to head coach.
