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

  // Calculate max height to show approximately 3 items (each item is ~80px with spacing)
  // Allow scrolling for items beyond 3
  const maxHeight = "260px"; // ~3 items * ~80px per item

  return (
    <div
      className="space-y-2 overflow-y-auto"
      style={{ maxHeight }}
    >
      {games.map((game) => (
        <GameResultCard key={game.id} game={game} />
      ))}
    </div>
  );
}
