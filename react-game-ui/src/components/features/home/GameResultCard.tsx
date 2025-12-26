import type { GameResult } from "@/types";

interface GameResultCardProps {
  game: GameResult;
}

/**
 * Game result card component
 * Displays a single game result with teams, scores, and rating count
 */
export function GameResultCard({ game }: GameResultCardProps) {
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

  return (
    <div className="bg-brand-card border border-brand-card-border rounded-xl p-4">
      {/* Game Type */}
      <div className="text-center mb-3">
        <p className="text-xs text-brand-text-dim">{game.gameType}</p>
      </div>

      {/* Teams and Scores - Using grid for perfect alignment */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-4">
        {/* Home Team */}
        <div className="flex flex-col items-center gap-2 w-full">
          {/* Team Name - Centered, fixed height for alignment */}
          <div className="h-12 flex items-center justify-center w-full">
            <span className="text-sm font-semibold text-white text-center line-clamp-2">
              {game.homeTeam.name}
            </span>
          </div>
          {/* Logo - Fixed size */}
          <div className="w-10 h-10 flex-shrink-0">
            {game.homeTeam.logoUrl ? (
              <img
                src={game.homeTeam.logoUrl}
                alt={game.homeTeam.name}
                className="w-10 h-10 rounded-full object-cover border border-brand-card-border"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-brand-dark border border-brand-card-border flex items-center justify-center">
                <span className="text-[10px] font-bold text-brand-text-dim">
                  {game.homeTeam.code}
                </span>
              </div>
            )}
          </div>
          {/* Score - Fixed height */}
          <div className="h-7 flex items-center justify-center">
            <span className="text-xl font-bold text-white">
              {game.homeTeam.score}
            </span>
          </div>
        </div>

        {/* Separator - Vertically centered */}
        <div className="flex items-center justify-center h-full pt-12">
          <span className="text-brand-text-dim text-xl font-medium">-</span>
        </div>

        {/* Away Team */}
        <div className="flex flex-col items-center gap-2 w-full">
          {/* Team Name - Centered, fixed height for alignment */}
          <div className="h-12 flex items-center justify-center w-full">
            <span className="text-sm font-semibold text-white text-center line-clamp-2">
              {game.awayTeam.name}
            </span>
          </div>
          {/* Logo - Fixed size */}
          <div className="w-10 h-10 flex-shrink-0">
            {game.awayTeam.logoUrl ? (
              <img
                src={game.awayTeam.logoUrl}
                alt={game.awayTeam.name}
                className="w-10 h-10 rounded-full object-cover border border-brand-card-border"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-brand-dark border border-brand-card-border flex items-center justify-center">
                <span className="text-[10px] font-bold text-brand-text-dim">
                  {game.awayTeam.code}
                </span>
              </div>
            )}
          </div>
          {/* Score - Fixed height */}
          <div className="h-7 flex items-center justify-center">
            <span className="text-xl font-bold text-white">
              {game.awayTeam.score}
            </span>
          </div>
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
