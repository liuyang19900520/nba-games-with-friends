import type { Metadata } from "next";
import { Suspense } from "react";
import { Header } from "@/components/layout/Header";
import { MatchupsPageClient } from "@/components/features/matchups/MatchupsPageClient";
import { fetchMatchupLineup } from "@/lib/db/matchups";
import { createClient } from "@/lib/auth/supabase";
import { getGameDate } from "@/lib/utils/game-date";

export const metadata: Metadata = {
  title: "Matchups - NBA Fantasy Manager",
  description: "View your starting lineup and friends leaderboard.",
};

/**
 * Matchups 页面
 *
 * 显示：
 * - MY STARTING 5: 当前阵容的5个球员（带实时统计）
 * - FRIENDS LEADERBOARD: 好友排行榜
 */
export default async function MatchupsPage() {
  // Get user and fetch lineup data
  let lineupData = null;
  let user = null;

  try {
    const supabase = await createClient();
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    user = currentUser;

    if (user) {
      const gameDate = await getGameDate();
      lineupData = await fetchMatchupLineup(user.id, gameDate);
    }
  } catch (error) {
    // Allow unauthenticated users to view (with empty data)
    console.error("[MatchupsPage] Error fetching data:", error);
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="Matchups" />
      <div className="flex-1 overflow-y-auto pt-[60px] px-4 pb-4">
        <Suspense fallback={<div className="text-white">Loading...</div>}>
          <MatchupsPageClient lineupData={lineupData} />
        </Suspense>
      </div>
    </div>
  );
}
