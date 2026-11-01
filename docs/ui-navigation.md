# UI navigation & display rules (v2 app)

## Bottom menu
Adapted from v1 (`legacy-v1`, `apps/web/src/components/layout/BottomNav.tsx`): four items in order Home, Leagues, Lineup, Profile; English labels,
lucide icons (Home, Trophy, basketball, User), colors (dim `#7A8B99`, active `#6EE2F5`),
90px gradient bar with blur/shadow, and the raised cyan→orange ring + halo on the active center button.
Implemented as `app/src/components/BottomNav.tsx` (rendered by each top-level page, not the native tabBar, so
WeChat and H5 look the same; icons rendered from the lucide paths by `app/scripts/render-nav-icons.mjs`).

| Menu item | Original meaning | v2 page | what's there |
|---|---|---|---|
| Home | recent games | `pages/index` 赛程 | date switcher, game cards → 比赛详情 |
| Leagues | leagues / standings | `pages/standings` 球队 / 球员 | 球队 → East/West standings and team stat ranks → 球队页; 球员 → shared category leaders, 基础/进阶 → 完整榜单 → 球员页 |
| **Lineup** (center) | pick 5 players to play with friends | `pages/lineup` 阵容 | v1 neon court, slots C/F/F/G/G → picker (search, position, tonight-only, team); saved locally; share = copy text. **UI only, no scoring** |
| Profile | user / settings | `pages/more` 我的 | language toggle, shortcut links (球队/球队榜/球员榜/赛程), 伤病报告, data source |

Detail pages (pushed, back button): 球队页 `pages/team`, 球员页 `pages/player`, 比赛详情 `pages/game`, 完整榜单 `pages/leaderlist`.
30-teams page (`pages/teams`) entry points: Leagues → 球队 → 全部球队 ›, Lineup → 全部球队 ›, Profile links.
Team page entry points: standings rows, team stat ranks, game header logos, player header team chip, Profile links.

## Player names (`app/src/lib/names.ts`)
- Detail headers: full name (zh `name_zh`, else ESPN name).
- Narrow places (table first column: box score / roster; leader rows): `tableName` = last name only
  (EN "Shai Gilgeous-Alexander" → "Gilgeous-Alexander", "Jaren Jackson Jr." → "Jackson Jr."; ZH ≤4 chars full, else part after the last `·`:
  "卡尔-安东尼·唐斯" → "唐斯"). Duplicate last names in one table get an initial ("J. Williams").
- Names are never ellipsized: cells wrap to max 2 lines (fixed row heights leave room).
- Fixtures add `last_name` / `short_name` to player objects; the API is asked to provide them everywhere (docs/FRONTEND-REQUESTS.md).

## Tables (`Table` in `app/src/components/ui.tsx`)
One component for every stat table: fixed first column (sticky, never scrolls) + horizontally scrollable body.
Every column has a fixed width from `colWidth(key)` applied identically to header and body cells, same padding and
center alignment; every row has the same fixed height in both halves → header and body always line up.

## League teams and players (2026-11-01)
- **Leagues** (`pages/standings`): 球队 / 球员 is the only primary Seg. 球队 opens directly to East standings, with one horizontally scrollable chip row: 东部 / 西部 / 赛区 / 数据榜. East/West shows that conference immediately; there is no separate 排名/数据榜 or 分区/赛区 Seg.
- **赛区** shows all six divisions as table groups, labelled with their conference. Row ranks and playoff colors refer to conference standings. A context label states the active view; 全部球队 remains a separate 44px entry beside it.
- **数据榜** replaces standings with team stat leaders; metric chips appear only in this view. Team filters and metric chips have at least 44px touch height; overflowing rows scroll horizontally. Table rows still open team details.
- **球员** reuses PlayerLeaders unchanged, including season, season type, basic/advanced, category navigation, and full-list links.
- **Matchups** is removed from the bottom menu. `pages/leaders` remains accessible as the player leaders page and highlights Leagues; its shared content also appears under Leagues → 球员.

## Task 4 (2026-10-30)
- **Home**: no date strip. Default = upcoming 14 days grouped by local day (今天/明天 headers, live pinned on top); Seg 即将开始 / 最近结果; 📅 picker = single day.
- **Leagues** (`pages/standings`): Seg 球队 / 球员. 球队 → 东部 / 西部 / 赛区 / 数据榜 chips (interaction updated above; metric chips appear only in 数据榜, from proposed `/api/v1/stats/teams`). 球员 → shared player leaders.
- **Lineup** (`pages/lineup`): Storage key `lineup:v2`. Total salary is information only. No points, no cap, no rooms, no accounts.
