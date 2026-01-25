---
description: Business requirements and features for the Web Application
service_path: apps/web
---

# Web App Business Rules

## Core Features
- **Profile**: User management, settings.
- **Games**: Display NBA games.
- **Fantasy**: Lineup setting, scoring.

## key Business Decisions
- **Timezone**: All dates and times MUST be displayed in **Japan Standard Time (JST)** (Asia/Tokyo).
  - This is the "Source of Truth" for the user interface.
  - "Today" refers to Today in Tokyo.
  - NBA Games from US "Yesterday" are shown as "Today" in Tokyo (e.g., US Jan 23 night game is Jan 24 morning in Tokyo).

## Removed Features
- **Simulated Date**: The ability to "mock" the current date has been removed. The app always uses the real current Tokyo date.
