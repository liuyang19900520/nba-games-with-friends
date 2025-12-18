# NBA Fantasy Manager

A modern Progressive Web App for managing your NBA fantasy team, built with React, TypeScript, and Tailwind CSS.

## Tech Stack

- **Framework**: React 18 (Vite)
- **Language**: TypeScript (Strict mode)
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Routing**: React Router DOM v6
- **State Management**: Zustand
- **Backend**: Supabase

## Features

- **Team Standings**: View conference standings with win/loss records and rankings
- **Roster View**: Detailed team roster with player statistics and fantasy scores
- **Infinite Scroll Leaderboard**: Browse player statistics with efficient infinite scrolling
- **Player Details**: Comprehensive player profiles with advanced analytics
- **Lineup Management**: Interactive court view for managing your fantasy lineup

## Setup

1. **Install dependencies:**

   ```bash
   npm install
   ```

1. **Configure environment variables:**

   Create a `.env` file in the root directory:

   ```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

1. **Start development server:**

   ```bash
   npm run dev
   ```

## Build

```bash
npm run build
```

## Development

The app will be available at `http://localhost:5173` (or the next available port).
