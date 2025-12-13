import { useParams } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { TeamDetailView } from '@/components/team/TeamDetailView';
import type { TeamDetail } from '@/types';

// Mock data - replace with API call
const mockTeamDetails: Record<string, TeamDetail> = {
  '1': {
    id: '1',
    name: 'Los Angeles Lakers',
    logo: 'https://a.espncdn.com/i/teamlogos/nba/500/lal.png',
    rank: 1,
    record: '45-20',
    conference: 'West',
    stats: {
      ppg: 118.5,
      rpg: 46.2,
      apg: 28.3,
    },
    players: [
      {
        id: 'lebron',
        name: 'LeBron James',
        position: 'SF',
        avatar: 'https://a.espncdn.com/combiner/i?img=/i/headshots/nba/players/full/1966.png',
        pts: 25.2,
        reb: 7.8,
        ast: 6.9,
        recentGames: [28, 32, 24, 30, 27, 35],
      },
    ],
  },
  '4': {
    id: '4',
    name: 'Golden State Warriors',
    logo: 'https://a.espncdn.com/i/teamlogos/nba/500/gs.png',
    rank: 3,
    record: '42-18',
    conference: 'West',
    stats: {
      ppg: 115.2,
      rpg: 44.8,
      apg: 29.1,
    },
    players: [
      {
        id: '1',
        name: 'Stephen Curry',
        position: 'PG',
        avatar: 'https://a.espncdn.com/combiner/i?img=/i/headshots/nba/players/full/3975.png',
        pts: 28.5,
        reb: 4.5,
        ast: 6.3,
        recentGames: [20, 28, 17, 19, 23, 35],
      },
      {
        id: '2',
        name: 'Klay Thompson',
        position: 'SG',
        avatar: 'https://a.espncdn.com/combiner/i?img=/i/headshots/nba/players/full/6475.png',
        pts: 21.8,
        reb: 3.8,
        ast: 2.4,
        '3pt%': 40.1,
      },
      {
        id: '3',
        name: 'Draymond Green',
        position: 'PF',
        avatar: 'https://a.espncdn.com/combiner/i?img=/i/headshots/nba/players/full/6589.png',
        pts: 8.5,
        reb: 7.2,
        ast: 6.8,
        stl: 1.4,
        blk: 0.8,
        defRating: 105.3,
        radarStats: {
          reb: 7.2,
          ast: 6.8,
          blk: 0.8,
          stl: 1.4,
        },
      },
      {
        id: '4',
        name: 'Andrew Wiggins',
        position: 'SF',
        avatar: 'https://a.espncdn.com/combiner/i?img=/i/headshots/nba/players/full/3136775.png',
        pts: 17.1,
        reb: 5.0,
        ast: 2.3,
        recentGames: [10, 13, 5, 11, 23, 30],
      },
      {
        id: '5',
        name: 'Kevon Looney',
        position: 'C',
        avatar: 'https://a.espncdn.com/combiner/i?img=/i/headshots/nba/players/full/3136196.png',
        pts: 6.9,
        reb: 9.3,
        ast: 2.5,
      },
    ],
  },
};

export function TeamDetailPage() {
  const { teamId } = useParams<{ teamId: string }>();

  const team = teamId ? mockTeamDetails[teamId] : null;

  if (!team) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-brand-text-dim">Team not found</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full max-w-md mx-auto">
      <Header title="Team Roster & Stats" showBack showSearch />
      <div className="flex-1 overflow-y-auto pt-[60px] pb-4">
        <TeamDetailView team={team} />
      </div>
    </div>
  );
}

