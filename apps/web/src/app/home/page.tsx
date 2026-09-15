import type { Metadata } from 'next';
import { Header } from '@/components/layout/Header';
import { HomePageClient } from '@/components/features/home/HomePageClient';
import { getRecentGames } from '@/lib/db/games';
import { getGameDate } from '@/lib/utils/game-date';
import { createClient } from '@/lib/auth/supabase';
import { getCreditsRemaining } from '@/app/payment/actions';
import { getAppEnvironment } from '@/lib/server/config';

export const metadata: Metadata = { title: 'Home - NBA Fantasy Manager', description: 'NBA games, lineup suggestions and matchup analysis.' };
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const today = await getGameDate();
  const userPromise = (async () => {
    try {
      const auth = await createClient();
      const { data: { user } } = await auth.auth.getUser();
      return user?.id || null;
    } catch { return null; }
  })();
  const [recentGames, userId, creditsRemaining] = await Promise.all([
    getRecentGames(20, today), userPromise, getCreditsRemaining(),
  ]);
  return (
    <div className="flex flex-col h-full">
      <Header title={getAppEnvironment() === 'local' ? 'Home · Local preview' : 'Home'} />
      <div className="flex-1 overflow-y-auto pt-[60px] px-4 pb-4">
        <HomePageClient initialGames={recentGames} initialDate={today} userId={userId} creditsRemaining={creditsRemaining} aiMode={process.env.AI_MODE === 'llm' ? 'llm' : 'demo'} />
      </div>
    </div>
  );
}
