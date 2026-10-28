# UI navigation & display rules (v2 app)

## Bottom menu = v1 menu
Copied from v1 (`legacy-v1`, `apps/web/src/components/layout/BottomNav.tsx`): same 5 items, order, English labels,
lucide icons (Home, Trophy, center basketball, Users, User), colors (dim `#7A8B99`, active `#6EE2F5`),
90px gradient bar with blur/shadow, and the raised cyan→orange ring + halo on the active center button.
Implemented as `app/src/components/BottomNav.tsx` (rendered by each top-level page, not the native tabBar, so
WeChat and H5 look the same; icons rendered from the lucide paths by `app/scripts/render-nav-icons.mjs`).

| v1 item | v1 meaning | v2 page | what's there |
|---|---|---|---|
| Home | recent games | `pages/index` 赛程 | date switcher, game cards → 比赛详情 |
| Leagues | leagues / standings | `pages/standings` 球队榜 | East/West standings → 球队页 |
| **Lineup** (center) | build a lineup | `pages/teams` 球队 | all 30 teams by conference/division → 球队页 (roster = "lineup") |
| Matchups | head-to-head | `pages/leaders` 球员榜 | category leaders, 基础/进阶 → 完整榜单 → 球员页 |
| Profile | user / settings | `pages/more` 我的 | language toggle, shortcut links (球队/球队榜/球员榜/赛程), 伤病报告, data source |

Detail pages (pushed, back button): 球队页 `pages/team`, 球员页 `pages/player`, 比赛详情 `pages/game`, 完整榜单 `pages/leaderlist`.
Team page entry points: standings rows, Lineup grid, game header logos, player header team chip, Profile links.

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
