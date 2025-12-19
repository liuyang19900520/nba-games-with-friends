import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { PlayerDetailView } from '@/components/player/PlayerDetailView';
import { usePlayerProfile } from '@/hooks/usePlayerProfile';
import type { PlayerDetail } from '@/types';

const mockRecentGames = [
  { date: '2024/03/27', opponent: '@LAL', min: 39, pts: 24, reb: 2, ast: 3, stl: 1, blk: 0, tov: 2, fantasy: 56.2 },
  { date: '2024/03/26', opponent: 'vs DAL', min: 36, pts: 18, reb: 7, ast: 3, stl: 2, blk: 1, tov: 3, fantasy: 75.4 },
  { date: '2024/03/24', opponent: '@HOR', min: 38, pts: 32, reb: 8, ast: 9, stl: 1, blk: 0, tov: 4, fantasy: 68.3 },
  { date: '2024/03/22', opponent: 'vs LAT', min: 35, pts: 28, reb: 6, ast: 7, stl: 2, blk: 0, tov: 2, fantasy: 72.1 },
  { date: '2024/03/20', opponent: '@PHX', min: 40, pts: 35, reb: 10, ast: 11, stl: 3, blk: 1, tov: 5, fantasy: 89.5 },
  { date: '2024/03/18', opponent: 'vs GSW', min: 37, pts: 30, reb: 9, ast: 8, stl: 1, blk: 0, tov: 3, fantasy: 78.2 },
  { date: '2024/03/16', opponent: '@DEN', min: 39, pts: 27, reb: 7, ast: 6, stl: 2, blk: 1, tov: 4, fantasy: 65.8 },
  { date: '2024/03/14', opponent: 'vs BOS', min: 36, pts: 22, reb: 5, ast: 4, stl: 1, blk: 0, tov: 2, fantasy: 58.3 },
  { date: '2024/03/12', opponent: '@MIA', min: 38, pts: 29, reb: 8, ast: 9, stl: 2, blk: 0, tov: 3, fantasy: 71.6 },
  { date: '2024/03/10', opponent: 'vs NYK', min: 35, pts: 26, reb: 6, ast: 5, stl: 1, blk: 1, tov: 2, fantasy: 63.4 },
];

const mockLeagueComparison = {
  scoring: 95,
  playmaking: 88,
  rebounding: 75,
  defense: 68,
  efficiency: 82,
  leagueMean: {
    scoring: 50,
    playmaking: 50,
    rebounding: 50,
    defense: 50,
    efficiency: 50,
  },
};

export function PlayerDetailPage() {
  const { playerId } = useParams<{ playerId: string }>();
  const { player: fetchedPlayer, loading, error } = usePlayerProfile({
    playerId: playerId || '',
  });

  const player: PlayerDetail | null = useMemo(() => {
    if (!fetchedPlayer) {
      return null;
    }

    return {
      ...fetchedPlayer,
      recentGames: mockRecentGames,
      leagueComparison: mockLeagueComparison,
    };
  }, [fetchedPlayer]);

  if (loading) {
    return (
      <div className="flex flex-col h-full max-w-md mx-auto">
        <Header title="Player Profile" showBack showShare showMore />
        <div className="flex-1 overflow-y-auto pt-[60px] pb-4 flex items-center justify-center">
          <p className="text-brand-text-dim">Loading player profile...</p>
        </div>
      </div>
    );
  }

  if (error || !player) {
    return (
      <div className="flex flex-col h-full max-w-md mx-auto">
        <Header title="Player Profile" showBack showShare showMore />
        <div className="flex-1 overflow-y-auto pt-[60px] pb-4 flex items-center justify-center">
          <p className="text-brand-text-dim">
            {error?.message || 'Player not found'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full max-w-md mx-auto">
      <Header title="Player Profile" showBack showShare showMore />
      <div className="flex-1 overflow-y-auto pt-[60px] pb-4">
        <PlayerDetailView player={player} />
      </div>
    </div>
  );
}

