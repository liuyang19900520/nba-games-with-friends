# Fantasy NBA PWA

A Progressive Web App for Fantasy NBA gaming, built with React, TypeScript, and Tailwind CSS.

## Tech Stack

- **Framework**: React 18 (Vite)
- **Language**: TypeScript (Strict mode)
- **Styling**: Tailwind CSS + Shadcn/ui
- **Icons**: Lucide React
- **Routing**: React Router DOM v6
- **State Management**: Zustand
- **PWA**: Vite PWA Plugin

## Project Structure

```
src/
├── components/
│   ├── ui/          # Shadcn/ui components
│   ├── layout/      # Layout components (Header, Footer, etc.)
│   └── features/    # Feature-specific components
├── pages/           # Page components
├── hooks/           # Custom React hooks
├── stores/          # Zustand stores
├── lib/             # Utility functions
├── types/           # TypeScript type definitions
└── styles/          # Global styles
```

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Design Philosophy

- **Mobile-First**: Native app-like UI, no browser scrollbars
- **Dark Mode**: Dark sports-analytics theme by default
- **Clean Code**: Functional components, custom hooks, strict typing


