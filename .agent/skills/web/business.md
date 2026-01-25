---
description: Business requirements and features for the Web Application
service_path: apps/web
---

# Web App Business Rules

## Core Features
- **Profile**: User management, settings.
- **Games**: Display NBA games.
- **Fantasy**: Lineup setting, scoring.

## Key Business Decisions
- **Timezone**: All dates and times MUST be displayed in **Japan Standard Time (JST)** (Asia/Tokyo).
  - This is the "Source of Truth" for the user interface.
  - "Today" refers to Today in Tokyo.
  - NBA Games from US "Yesterday" are shown as "Today" in Tokyo (e.g., US Jan 23 night game is Jan 24 morning in Tokyo).

## Game Date Display (2026-01 Update)
- **Direct Tokyo Date**: Use `games_tokyo` view's `game_date_tokyo` column for filtering.
- **No More "-1 Day Hack"**: The old workaround in `getTokyoDate()` was removed.
- **TBD Games**: Games with `is_time_tbd = true` should display "TBD" instead of time.

### Example Display
| UTC Time | Tokyo Display |
|----------|---------------|
| 2026-01-25T20:00:00Z | Jan 26, 05:00 |
| 2026-01-26T00:00:00Z (TBD) | Jan 26, TBD |

## Removed Features
- **Simulated Date**: The ability to "mock" the current date has been removed. The app always uses the real current Tokyo date.
- **-1 Day Hack**: Removed from `getTokyoDate()` - database now handles timezone conversion.
