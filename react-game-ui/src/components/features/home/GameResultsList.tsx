import { GameResultCard } from "./GameResultCard";
import type { GameResult } from "@/types";

interface GameResultsListProps {
  games: GameResult[];
}

/**
 * Game results list component
 * Displays a list of recent game results
 */
export function GameResultsList({ games }: GameResultsListProps) {
  if (games.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-brand-text-dim">No recent games available</p>
      </div>
    );
  }

  // Limit to 3 games and make scrollable
  const displayGames = games.slice(0, 3);

  return (
    <div className="space-y-3 max-h-[600px] overflow-y-auto">
      {displayGames.map((game) => (
        <GameResultCard key={game.id} game={game} />
      ))}
    </div>
  );
}
