'use client';

import { useMemo } from "react";
import { Header } from "@/components/layout/Header";
import { PlayerDetailView } from "@/components/player/PlayerDetailView";
import type { DbPlayer, DbPlayerSeasonStats } from "@/types/db";
import type { PlayerDetail } from "@/types";

interface PlayerPageClientProps {
  initialProfile: DbPlayer;
  initialStats: DbPlayerSeasonStats | null;
}

/**
 * Player detail page client component (props-driven, no client-side initial fetch)
 */
export function PlayerPageClient({
  initialProfile,
  initialStats,
}: PlayerPageClientProps) {
  const player: PlayerDetail = useMemo(() => {
    const teamName = initialStats?.team?.name ?? "Unknown Team";
    const teamLogo = initialStats?.team?.logo_url ?? undefined;

    return {
      id: String(initialProfile.id),
      name: initialProfile.full_name,
      position: initialProfile.position || "N/A",
      jerseyNumber: "#00",
      team: teamName,
      teamLogo,
      avatar: initialProfile.headshot_url || "/placeholder-avatar.png",
      ppg: initialStats?.pts ?? 0,
      rpg: initialStats?.reb ?? 0,
      apg: initialStats?.ast ?? 0,
      stl: initialStats?.stl ?? 0,
      blk: initialStats?.blk ?? 0,
      tov: 0,
      fantasyScore: initialStats?.fantasy_avg ?? 0,
      clutchTimeStats: {
        points: { player: 0, league: 0, percentile: 0 },
        assists: { player: 0, league: 0, percentile: 0 },
        rebounds: { player: 0, league: 0, percentile: 0 },
      },
      shotChart: {
        fgPercentage: 0,
        threePointPercentage: 0,
      },
      leagueComparison: {
        scoring: 50,
        playmaking: 50,
        rebounding: 50,
        defense: 50,
        efficiency: 50,
        leagueMean: {
          scoring: 50,
          playmaking: 50,
          rebounding: 50,
          defense: 50,
          efficiency: 50,
        },
      },
      recentGames: [],
      isFollowed: false,
    };
  }, [initialProfile, initialStats]);

  return (
    <div className="flex flex-col h-full max-w-md mx-auto">
      <Header title="Player Profile" showBack showShare showMore />
      <div className="flex-1 overflow-y-auto pt-[60px] pb-4">
        <PlayerDetailView player={player} />
      </div>
    </div>
  );
}
