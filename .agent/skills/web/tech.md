---
description: Development guidelines for the Next.js Web Application (apps/web)
service_path: apps/web
tech_stack: [Next.js 15, React, Supabase, TailwindCSS, TypeScript]
---

# Web App Tech Stack

**Location**: `apps/web/`
**Standalone SKILL.md**: `apps/web/SKILL.md` (for IDE-specific agents)

## Tech Stack
- Next.js 15 (App Router)
- React (Server Components by default)
- Supabase (Auth + Database)
- TailwindCSS (Styling)
- TypeScript (Strict mode)

## Architecture Rules

### 1. Server vs Client Components
- **Default**: Server Components (RSC)
- **Add `'use client'` ONLY when**:
  - Using `useState`, `useEffect`, `useRef`
  - Using browser APIs (localStorage, window)
  - Using event handlers (onClick, onChange)

### 2. Data Fetching Pattern
```typescript
// Server Component - Direct DB access
async function Page() {
  const data = await supabase.from('table').select();
  return <Component data={data} />;
}

// Client Component - Use Server Actions
'use client'
function Form() {
  const handleSubmit = async (formData: FormData) => {
    await serverAction(formData);
  };
}
```

### 3. Supabase Integration
- **Server**: Use `createServerClient` from `@supabase/ssr`
- **Client**: Use singleton from `@/lib/supabase`
- **Security**: RLS enabled on all tables

### 4. Folder Structure
```
src/
├── app/                # App Router pages
├── components/
│   ├── ui/            # Generic components (Button, Input)
│   └── features/      # Business components (GameCard, AuthForm)
├── lib/               # Utilities, Supabase setup
├── hooks/             # Custom React hooks
└── types/             # TypeScript interfaces
```

## Lessons Learned

> [!TIP]
> **Hydration Mismatch**: When using date/time, ensure server and client render the same value. Use `suppressHydrationWarning` or render dates only on client.

> [!TIP]
> **Supabase Auth Callback**: The `/auth/callback` route must use `createRouteHandlerClient` not the regular server client.
