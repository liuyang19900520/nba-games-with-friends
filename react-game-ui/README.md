# NBA Fantasy Manager

A modern, full-stack NBA fantasy basketball application built with Next.js 15, React 19, TypeScript, and Supabase.

## 🚀 Tech Stack

- **Framework**: Next.js 15 (App Router)
- **UI Library**: React 19
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Auth + Storage)
- **Authentication**: Supabase Auth (Google OAuth, SMS OTP, Email/Password)
- **Deployment**: Vercel (recommended)

## 📋 Prerequisites

- Node.js 20.x or higher
- npm or yarn
- Supabase account and project
- (Optional) Vercel account for deployment

## 🛠️ Local Development Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd react-game-ui
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Variables

Create a `.env.local` file in the root directory:

```env
# Supabase Configuration (Client-side)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Supabase Configuration (Server-side)
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Optional: Enable debug logs in production
NEXT_PUBLIC_ENABLE_DEBUG_LOGS=false
```

**Important Notes:**
- `NEXT_PUBLIC_*` variables are exposed to the browser
- `SUPABASE_SERVICE_ROLE_KEY` should NEVER be exposed to the client
- Get these values from your Supabase project dashboard: Settings → API

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 🏗️ Project Structure

```
react-game-ui/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── (routes)/          # Route pages (home, lineup, leagues, etc.)
│   │   ├── auth/              # Authentication callbacks
│   │   ├── login/             # Login page and server actions
│   │   └── layout.tsx         # Root layout
│   ├── components/            # React components
│   │   ├── auth/              # Authentication components
│   │   ├── features/          # Feature-specific components
│   │   │   ├── lineup/        # Lineup page components
│   │   │   ├── profile/       # Profile page components
│   │   │   ├── player/        # Player detail components
│   │   │   └── team/          # Team detail components
│   │   ├── layout/            # Layout components (Header, BottomNav)
│   │   ├── leaderboard/       # Leaderboard components
│   │   ├── lineup/            # Lineup UI components
│   │   ├── player/            # Player detail view components
│   │   ├── team/              # Team detail view components
│   │   └── ui/                # Reusable UI components
│   ├── config/                # Configuration files
│   │   ├── constants.ts       # App constants
│   │   └── env.ts             # Environment utilities & logger
│   ├── hooks/                 # Custom React hooks
│   ├── lib/                   # Utility libraries
│   │   ├── auth/              # Authentication utilities
│   │   ├── db/                # Data Access Layer (DAL)
│   │   ├── transformers/      # Data transformation utilities
│   │   ├── supabase.ts        # Client-side Supabase client
│   │   └── utils.ts           # General utilities
│   ├── middleware.ts          # Next.js middleware (auth protection)
│   ├── styles/                # Global styles
│   └── types/                 # TypeScript type definitions
│       ├── db.ts              # Database types
│       ├── index.ts           # UI types
│       └── nba.ts             # NBA-specific types
├── public/                    # Static assets
├── .env.local                 # Environment variables (not committed)
├── next.config.ts             # Next.js configuration
├── tailwind.config.js         # Tailwind CSS configuration
├── tsconfig.json              # TypeScript configuration
└── package.json               # Dependencies and scripts
```

## 🎯 Key Features

### Authentication
- **Google OAuth**: One-click sign-in with Google
- **Phone SMS OTP**: Passwordless authentication via SMS
- **Email/Password**: Traditional email-based authentication
- **Account Linking**: Link multiple auth methods to one account

### Core Features
- **Lineup Management**: Create and manage daily fantasy lineups
- **Player Profiles**: Detailed player statistics and performance charts
- **Team Rosters**: View team rosters and team statistics
- **League Standings**: Real-time league standings and rankings
- **Matchups**: View upcoming and past game matchups

## 📝 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## 🚀 Production Deployment

### Vercel (Recommended)

1. Push your code to GitHub/GitLab/Bitbucket
2. Import your repository in Vercel
3. Add environment variables in Vercel project settings
4. Deploy!

**Environment Variables in Vercel:**
- Go to Project Settings → Environment Variables
- Add all variables from `.env.local`
- Set appropriate environments (Production, Preview, Development)

### Other Platforms

The app can be deployed to any platform that supports Next.js:
- Netlify
- AWS Amplify
- Railway
- Self-hosted (Docker, etc.)

## 🔒 Security Best Practices

1. **Never commit `.env.local`** - It's already in `.gitignore`
2. **Use Service Role Key only on server** - Never expose `SUPABASE_SERVICE_ROLE_KEY` to the client
3. **Enable Row Level Security (RLS)** - Configure RLS policies in Supabase
4. **Validate user input** - Always validate and sanitize user inputs
5. **Use HTTPS in production** - Always use HTTPS for production deployments

## 🧪 Development Guidelines

### Code Style
- **Components**: PascalCase (e.g., `PlayerCard.tsx`)
- **Functions/Variables**: camelCase (e.g., `fetchData`, `userId`)
- **Types/Interfaces**: PascalCase (e.g., `PlayerDetail`, `DbPlayer`)
- **Files**: kebab-case for utilities, PascalCase for components

### Best Practices
- **Server Components First**: Use RSC (React Server Components) by default
- **Client Components**: Only use `'use client'` when necessary (interactivity, hooks)
- **Data Fetching**: Use Server Components and Server Actions for data operations
- **Error Handling**: Use Error Boundaries (`error.tsx`) for error handling
- **Loading States**: Use Suspense boundaries with Skeleton components
- **Type Safety**: Avoid `any`, use strict TypeScript types

### Architecture Patterns
- **Data Access Layer (DAL)**: All database queries in `src/lib/db/`
- **Transformers**: Data transformation logic in `src/lib/transformers/`
- **Server Actions**: Authentication and mutations in `src/app/login/actions.ts`
- **Middleware**: Route protection in `src/middleware.ts`

## 🐛 Troubleshooting

### Build Errors
- Ensure all environment variables are set
- Run `npm install` to ensure dependencies are installed
- Clear `.next` folder and rebuild: `rm -rf .next && npm run build`

### Authentication Issues
- Verify Supabase project settings
- Check OAuth redirect URLs in Supabase dashboard
- Ensure environment variables are correctly set

### Database Connection Issues
- Verify Supabase project is active
- Check network connectivity
- Review Supabase dashboard logs

## 📚 Additional Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [React 19 Documentation](https://react.dev)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)

## 📄 License

[Your License Here]

## 👥 Contributing

[Contributing guidelines here]

---

**Built with ❤️ using Next.js 15 and Supabase**
