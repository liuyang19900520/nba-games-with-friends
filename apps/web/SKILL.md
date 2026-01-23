---
description: Development guidelines for the Next.js Web App.
---

# Web App Skills (apps/web)

**Tech Stack**: Next.js, React, Supabase, TailwindCSS.

## Global Context (Standalone)
- **Language**: Doc/Comments in English. Chat in Simplified Chinese (简体中文).
- **Environment**: Use `.env.development` (Local) vs `.env.production`.
- **Secrets**: No hardcoded secrets.

## Rules & Best Practices

### 1. Next.js 15 Architecture
- **Server Components (RSC)**: Default to Server Components.
    - Use async/await for direct DB calls in RSC.
    - **No `useEffect`** for data fetching in RSC.
- **Client Components**: Add `'use client'` at the top ONLY when:
    - You need `useState`, `useEffect`.
    - You need browser API (localStorage, window).
    - You need event listeners (onClick).

### 2. Supabase Data Integration
- **Server Side**: Use `@supabase/ssr` with `createServerClient`.
    - Do NOT import the client-side singleton in Server Components.
- **Client Side**: Use the singleton from `@/lib/supabase` (wrapped `createBrowserClient`).
- **Security**: Enable RLS (Row Level Security) on all tables. Never trust the client.

### 3. Styling (TailwindCSS)
- **Utility First**: Write standard Tailwind classes.
- **clsx/tailwind-merge**: Use `cn()` helper for conditional class merging.
- **Responsive**: Mobile-first approach (`block md:flex`).

### 4. Folder Structure (Feature-Based)
```text
src/
  app/              # App Router (Pages)
  components/
    ui/             # Generic (Button, Input) - Shadcn/ui style
    features/       # Business logic (e.g., AuthForm, GameCard)
  lib/              # Utilities & Supabase setup
  hooks/            # Custom React Hooks
  types/            # TypeScript Interfaces
```

### 5. State Management
- **Server State**: React Query is NOT needed if using RSC + Server Actions (simplifies stack).
- **Client State**:
    - URL Params (`useSearchParams`) for shareable state (filters, pagination).
    - `Zustand` for global app state (if complex).
    - `Context` for simple compound components.

## Debugging
- Use `npm run dev` to start the local server.
- `.vscode/launch.json` should be configured for Next.js debugging.

## Lessons Learned (Auto-Generated)
> [!TIP]
> Agents: Append new difficult bugs/solutions here.
