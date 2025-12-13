import { useParams } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { PlayerDetailView } from '@/components/player/PlayerDetailView';
import type { PlayerDetail } from '@/types';

// Mock data - replace with API call
const mockPlayerDetails: Record<string, PlayerDetail> = {
  '1': {
    id: '1',
    name: 'Luka Dončić',
    position: 'PG/SG',
    jerseyNumber: '#77',
    team: 'Dallas Mavericks',
    teamLogo: 'https://a.espncdn.com/i/teamlogos/nba/500/dal.png',
    avatar: 'https://a.espncdn.com/combiner/i?img=/i/headshots/nba/players/full/4066648.png',
    ppg: 33.8,
    rpg: 9.2,
    apg: 8.7,
    clutchTimeStats: {
      points: { player: 33.8, league: 8.2, percentile: 411 },
      assists: { player: 10.5, league: 1.8, percentile: 8.7 },
      rebounds: { player: 8.7, league: 3.2, percentile: 11.8 },
    },
    shotChart: {
      fgPercentage: 48.5,
      threePointPercentage: 39.2,
    },
    leagueComparison: {
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
    },
    isFollowed: false,
  },
};

export function PlayerDetailPage() {
  const { playerId } = useParams<{ playerId: string }>();

  const player = playerId ? mockPlayerDetails[playerId] : null;

  if (!player) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-brand-text-dim">Player not found</p>
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

