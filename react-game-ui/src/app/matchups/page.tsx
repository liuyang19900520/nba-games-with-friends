import type { Metadata } from "next";
import { Header } from "@/components/layout/Header";
import { MatchupsPageClient } from "@/components/features/matchups/MatchupsPageClient";

export const metadata: Metadata = {
  title: "Matchups - NBA Fantasy Manager",
  description: "View your starting lineup, score history, and friends leaderboard.",
};

/**
 * Matchups 页面
 *
 * 显示：
 * - MY STARTING 5: 当前阵容的5个球员
 * - DAILY FANTASY SCORE HISTORY: 过去7天的分数历史
 * - FRIENDS LEADERBOARD: 好友排行榜
 */
export default async function MatchupsPage() {
  return (
    <div className="flex flex-col h-full">
      <Header title="Matchups" />
      <div className="flex-1 overflow-y-auto pt-[60px] px-4 pb-4">
        <MatchupsPageClient />
      </div>
    </div>
  );
}
