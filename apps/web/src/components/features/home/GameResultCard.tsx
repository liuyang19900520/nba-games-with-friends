"use client";

import { useRouter } from "next/navigation";
import type { GameResult } from "@/types";
import { formatTokyoTime } from "@/lib/utils/timezone";

interface GameResultCardProps {
  game: GameResult;
}

/**
 * Game result card component
 * Displays a single game result with teams, scores, and rating count
 */
export function GameResultCard({ game }: GameResultCardProps) {
  const router = useRouter();

  const handleClick = () => {
    router.push(`/match/${game.id}`);
  };

  const formatRatingCount = (count?: number): string => {
    if (!count) return "";
    if (count >= 100000) {
      return `${(count / 10000).toFixed(1)}K JRs ratings`;
    }
    if (count >= 10000) {
      return `${(count / 10000).toFixed(1)}K JRs ratings`;
    }
    return `${count} JRs ratings`;
  };

  const formatGameTime = (dateString?: string): string => {
    if (!dateString) return "";
    return formatTokyoTime(dateString);
  };

  const isScheduled = game.status === "Scheduled" || game.status === "scheduled";
  const displayTime = isScheduled && game.gameDate ? formatGameTime(game.gameDate) : null;
  const displayStatus = !isScheduled && game.status ? game.status : null;

  return (
    <div
      className="bg-brand-card border border-brand-card-border rounded-lg p-3 cursor-pointer hover:bg-brand-card/80 transition-colors"
      onClick={handleClick}
    >
      {/* Game Type - Top center */}
      <div className="text-center mb-3">
        <p className="text-xs text-brand-text-dim">{game.gameType}</p>
      </div>

      {/* Flat horizontal layout: Team1 | Status | Team2 */}
      <div className="flex items-center justify-between gap-3">
        {/* Home Team - Left side: Code | Logo | Score */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-base font-bold text-white whitespace-nowrap">
            {game.homeTeam.code}
          </span>
          <div className="w-8 h-8 flex-shrink-0">
            {game.homeTeam.logoUrl ? (
              <img
                src={game.homeTeam.logoUrl}
                alt={game.homeTeam.name}
                className="w-8 h-8 rounded-full object-cover"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-brand-dark border border-brand-card-border flex items-center justify-center">
                <span className="text-[9px] font-bold text-brand-text-dim">
                  {game.homeTeam.code}
                </span>
              </div>
            )}
          </div>
          <span className="text-xl font-bold text-white whitespace-nowrap">
            {game.homeTeam.score}
          </span>
        </div>

        {/* Status/Time - Center with decorative lines */}
        <div className="flex flex-col items-center justify-center gap-1 flex-shrink-0">
          {displayTime && (
            <>
              <div className="w-8 h-px bg-brand-blue"></div>
              <span className="text-xs text-brand-text-dim whitespace-nowrap">
                {displayTime}
              </span>
              <div className="w-8 h-px bg-brand-blue"></div>
            </>
          )}
          {displayStatus && (
            <>
              <div className="w-8 h-px bg-brand-blue"></div>
              <span className="text-xs text-brand-blue font-semibold whitespace-nowrap">
                {displayStatus}
              </span>
              <div className="w-8 h-px bg-brand-blue"></div>
            </>
          )}
        </div>

        {/* Away Team - Right side: Score | Logo | Code */}
        <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
          <span className="text-xl font-bold text-white whitespace-nowrap">
            {game.awayTeam.score}
          </span>
          <div className="w-8 h-8 flex-shrink-0">
            {game.awayTeam.logoUrl ? (
              <img
                src={game.awayTeam.logoUrl}
                alt={game.awayTeam.name}
                className="w-8 h-8 rounded-full object-cover"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-brand-dark border border-brand-card-border flex items-center justify-center">
                <span className="text-[9px] font-bold text-brand-text-dim">
                  {game.awayTeam.code}
                </span>
              </div>
            )}
          </div>
          <span className="text-base font-bold text-white whitespace-nowrap">
            {game.awayTeam.code}
          </span>
        </div>
      </div>

      {/* Rating Count */}
      {game.ratingCount && (
        <div className="mt-3 text-center">
          <p className="text-xs text-brand-text-dim">
            {formatRatingCount(game.ratingCount)}
          </p>
        </div>
      )}
    </div>
  );
}
