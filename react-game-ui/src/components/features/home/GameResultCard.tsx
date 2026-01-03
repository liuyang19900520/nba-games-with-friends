"use client";

import { useRouter } from "next/navigation";
import type { GameResult } from "@/types";

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
    try {
      const date = new Date(dateString);
      // Format as "MM/DD HH:mm" (24-hour format)
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      const hours = String(date.getHours()).padStart(2, "0");
      const minutes = String(date.getMinutes()).padStart(2, "0");
      return `${month}/${day} ${hours}:${minutes}`;
    } catch {
      return "";
    }
  };

  const isScheduled = game.status === "Scheduled";
  const gameTime = isScheduled ? formatGameTime(game.gameDate) : null;

  return (
    <div
      className="bg-brand-card border border-brand-card-border rounded-lg p-3 cursor-pointer hover:bg-brand-card/80 transition-colors"
      onClick={handleClick}
    >
      {/* Game Type */}
      <div className="text-center mb-2">
        <p className="text-xs text-brand-text-dim">{game.gameType}</p>
      </div>

      {/* Teams and Scores - Using grid for perfect alignment */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        {/* Home Team */}
        <div className="flex flex-col items-center gap-1.5 w-full">
          {/* Team Name - Centered, fixed height for alignment */}
          <div className="h-8 flex items-center justify-center w-full">
            <span className="text-sm font-semibold text-white text-center line-clamp-2">
              {game.homeTeam.name}
            </span>
          </div>
          {/* Logo and Score - Horizontal layout */}
          <div className="flex items-center gap-2">
            {/* Score on the left */}
            <span className="text-lg font-bold text-white min-w-[24px] text-right">
              {game.homeTeam.score}
            </span>
            {/* Logo in the middle */}
            <div className="w-8 h-8 flex-shrink-0">
              {game.homeTeam.logoUrl ? (
                <img
                  src={game.homeTeam.logoUrl}
                  alt={game.homeTeam.name}
                  className="w-8 h-8 rounded-full object-cover border border-brand-card-border"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-brand-dark border border-brand-card-border flex items-center justify-center">
                  <span className="text-[9px] font-bold text-brand-text-dim">
                    {game.homeTeam.code}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Separator with game time */}
        <div className="flex flex-col items-center justify-center gap-1">
          {gameTime && (
            <span className="text-[10px] text-brand-text-dim whitespace-nowrap">
              {gameTime}
            </span>
          )}
          <span className="text-brand-text-dim text-lg font-medium">-</span>
        </div>

        {/* Away Team */}
        <div className="flex flex-col items-center gap-1.5 w-full">
          {/* Team Name - Centered, fixed height for alignment */}
          <div className="h-8 flex items-center justify-center w-full">
            <span className="text-sm font-semibold text-white text-center line-clamp-2">
              {game.awayTeam.name}
            </span>
          </div>
          {/* Logo and Score - Horizontal layout */}
          <div className="flex items-center gap-2">
            {/* Logo on the left */}
            <div className="w-8 h-8 flex-shrink-0">
              {game.awayTeam.logoUrl ? (
                <img
                  src={game.awayTeam.logoUrl}
                  alt={game.awayTeam.name}
                  className="w-8 h-8 rounded-full object-cover border border-brand-card-border"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-brand-dark border border-brand-card-border flex items-center justify-center">
                  <span className="text-[9px] font-bold text-brand-text-dim">
                    {game.awayTeam.code}
                  </span>
                </div>
              )}
            </div>
            {/* Score on the right */}
            <span className="text-lg font-bold text-white min-w-[24px] text-left">
              {game.awayTeam.score}
            </span>
          </div>
        </div>
      </div>

      {/* Rating Count */}
      {game.ratingCount && (
        <div className="mt-2 text-center">
          <p className="text-xs text-brand-text-dim">
            {formatRatingCount(game.ratingCount)}
          </p>
        </div>
      )}
    </div>
  );
}
