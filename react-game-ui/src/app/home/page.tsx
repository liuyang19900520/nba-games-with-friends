import type { Metadata } from "next";
import { Header } from "@/components/layout/Header";
import { GameResultsList } from "@/components/features/home/GameResultsList";
import { getRecentGames } from "@/lib/db/games";
import { getGameDate } from "@/lib/utils/game-date";
import { logger } from "@/config/env";

export const metadata: Metadata = {
  title: "Home - NBA Fantasy Manager",
  description: "Overview of your NBA fantasy activity and navigation entry.",
};

/**
 * Home page - Dashboard with recent game results
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

  return (
    <div className="flex flex-col h-full">
      <Header title="Home" />
      <div className="flex-1 overflow-y-auto pt-[60px] px-4 pb-4">
        <div className="max-w-md mx-auto space-y-6">
          {/* Recent Games Section */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-4">
              Recent Games
            </h2>
            <GameResultsList games={recentGames} />
          </section>
        </div>
      </div>
    </div>
  );
}
