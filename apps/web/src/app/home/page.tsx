import type { Metadata } from "next";
import { Header } from "@/components/layout/Header";
import { HomePageClient } from "@/components/features/home/HomePageClient";
import { getRecentGames } from "@/lib/db/games";
import { getGameDate } from "@/lib/utils/game-date";
import { logger } from "@/config/env";
import { createClient } from "@/lib/auth/supabase";
import { getCreditsRemaining } from "@/app/payment/actions";

export const metadata: Metadata = {
  title: "Home - NBA Fantasy Manager",
  description: "Overview of your NBA fantasy activity and navigation entry.",
};

export const dynamic = "force-dynamic";

/**
 * Home page - Dashboard with date selector and recent game results
 */
export default async function HomePage() {
  // Get configured game date
  const gameDate = await getGameDate();

  // Fetch recent games for the configured date (returns empty array if games table doesn't exist)
  // Note: Using getRecentGames which is cached. For debugging, you can temporarily
  // import fetchRecentGames directly to bypass cache.
  const recentGames = await getRecentGames(10, gameDate);

  // Debug: Log the result
  logger.info(`[HomePage] Received ${recentGames.length} games`);
  if (recentGames.length > 0) {
    logger.info("[HomePage] First game:", JSON.stringify(recentGames[0], null, 2));
  } else {
    logger.warn("[HomePage] No games returned from getRecentGames");
  }

  // Get user info and AI credits
  let userId: string | null = null;
  let creditsRemaining = 0;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      userId = user.id;
      creditsRemaining = await getCreditsRemaining();
    }
  } catch {
    // Ignore auth errors
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="Home" />
      <div className="flex-1 overflow-y-auto pt-[60px] px-4 pb-4">
        <HomePageClient
          initialGames={recentGames}
          initialDate={gameDate}
          userId={userId}
          creditsRemaining={creditsRemaining}
        />
      </div>
    </div>
  );
}
