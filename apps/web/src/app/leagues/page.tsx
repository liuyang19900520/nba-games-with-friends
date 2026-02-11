import type { Metadata } from "next";
import { LeaderboardPage } from "@/components/leaderboard/LeaderboardPage";
import { fetchStandings } from "@/lib/db/standings";
import { fetchPlayerLeaderboardStats } from "@/lib/db/players";
import { transformDbStandingToEntry } from "@/lib/transformers/standings";
import { DEFAULT_SEASON, CONFERENCES } from "@/config/constants";

export const metadata: Metadata = {
  title: "Leagues - NBA Fantasy Manager",
  description: "View NBA team and player leaderboards for your fantasy decisions.",
};

export const dynamic = "force-dynamic";
export const revalidate = 60;

export default async function LeaguesPage() {
  const [dbStandings, playerStats] = await Promise.all([
    // 不传 conference，获取东西部全部数据，前端用 filter 区分 EAST/WEST
    fetchStandings({
      season: DEFAULT_SEASON,
    }),
    fetchPlayerLeaderboardStats(DEFAULT_SEASON, 100),
  ]);

  const initialStandings = dbStandings.map(transformDbStandingToEntry);

  return (
    <LeaderboardPage
      initialStandings={initialStandings}
      initialConference={CONFERENCES.EAST}
      initialPlayerStats={playerStats}
    />
  );
}
