"use client";

import { MatchHeader } from "./MatchHeader";
import { PlayerStatsSection } from "./PlayerStatsSection";
import type { MatchDetail } from "@/types";

interface MatchPageClientProps {
  match: MatchDetail;
}

export function MatchPageClient({ match }: MatchPageClientProps) {
  return (
    <div className="flex flex-col h-full bg-brand-dark">
      {/* Match Header */}
      <MatchHeader match={match} />

      {/* Content Area - Scrollable (Stats only) */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          {/* Player Statistics Section */}
          <PlayerStatsSection
            awayTeamPlayers={match.awayTeamPlayers}
            homeTeamPlayers={match.homeTeamPlayers}
            awayTeamName={match.awayTeam.name}
            homeTeamName={match.homeTeam.name}
          />
        </div>
      </div>
    </div>
  );
}
