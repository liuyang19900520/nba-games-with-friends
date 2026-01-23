import { Suspense } from 'react';
import { Header } from '@/components/layout/Header';
import { LineupPageClient } from '@/components/features/lineup/LineupPageClient';
import { LineupPageSkeleton } from '@/components/features/lineup/LineupPageSkeleton';
import { LineupErrorDisplay } from '@/components/features/lineup/LineupErrorDisplay';
import { fetchPlayersWithGames } from '@/lib/db/players';
import { getTodayLineup } from '@/app/lineup/actions';
import { createClient } from '@/lib/auth/supabase';
import { getGameDate } from '@/lib/utils/game-date';

/**
 * Lineup Page - Server Component (RSC)
 *
 * Pure server component responsible for:
 * - Static layout (Header, background container)
 * - Server-side data fetching
 * - Get user login status (optional, for read-only/editable mode distinction)
 * - Error boundary handling
 * - Suspense streaming rendering
 *
 * All interaction logic is handled in LineupPageClient.
 * Note: /lineup is now a public page, unauthenticated users can also access (read-only mode)
 */
export default async function LineupPage() {
  try {
    // ✅ Server-side data fetching (in RSC)
    // Get configured game date (from cookie or env var)
    const gameDate = await getGameDate();
    const players = await fetchPlayersWithGames(gameDate);

    // ✅ Get user login status and today's lineup (optional)
    // If user is not logged in, user is null, LineupPageClient will handle read-only mode
    let user = null;
    let initialLineup = null;

    try {
      const supabase = await createClient();
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      user = currentUser;

      // If user is logged in, fetch today's lineup
      if (user) {
        const lineupData = await getTodayLineup();
        if (lineupData.lineup) {
          initialLineup = {
            ...lineupData.lineup,
            items: lineupData.items || [],
          };
        }
      }
    } catch {
      // Ignore auth errors, allow unauthenticated users to access
    }

    return (
      <div className="flex flex-col h-full">
        {/* Static Header - rendered in RSC */}
        <Header title="My Lineup Selection" />

        {/* Content area - wrap client component with Suspense */}
        <div className="flex-1 overflow-y-auto pt-[60px]">
          <Suspense fallback={<LineupPageSkeleton />}>
            <LineupPageClient
              players={players}
              user={user}
              initialLineup={initialLineup}
            />
          </Suspense>
        </div>
      </div>
    );
  } catch (error) {
    // Error boundary - handled in RSC
    return (
      <div className="flex flex-col h-full">
        <Header title="My Lineup Selection" />
        <div className="flex-1 overflow-y-auto pt-[60px]">
          <LineupErrorDisplay error={error} />
        </div>
      </div>
    );
  }
}
