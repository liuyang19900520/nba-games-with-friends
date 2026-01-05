'use client';

import { StartingFiveSection } from './StartingFiveSection';
import { FriendsLeaderboardSection } from './FriendsLeaderboardSection';

// Mock data - will be replaced with real data later
const MOCK_STARTING_FIVE = [
  {
    id: '1',
    name: 'LeBron James',
    firstName: 'LeBron',
    lastName: 'James',
    position: 'SF',
    teamLogo: 'https://cdn.nba.com/logos/nba/1610612747/global/L/logo.svg',
    avatar: 'https://cdn.nba.com/headshots/nba/latest/1040x760/2544.png',
    status: 'LIVE' as const,
    pts: 28,
    reb: 8,
    ast: 10,
    fpts: 58.4,
  },
  {
    id: '2',
    name: 'Stephen Curry',
    firstName: 'Stephen',
    lastName: 'Curry',
    position: 'PG',
    teamLogo: 'https://cdn.nba.com/logos/nba/1610612744/global/L/logo.svg',
    avatar: 'https://cdn.nba.com/headshots/nba/latest/1040x760/201939.png',
    status: 'FINAL' as const,
    pts: 35,
    reb: 4,
    ast: 6,
    fpts: 54.2,
  },
  {
    id: '3',
    name: 'Nikola Jokic',
    firstName: 'Nikola',
    lastName: 'Jokic',
    position: 'C',
    teamLogo: 'https://cdn.nba.com/logos/nba/1610612743/global/L/logo.svg',
    avatar: 'https://cdn.nba.com/headshots/nba/latest/1040x760/203999.png',
    status: 'LIVE' as const,
    pts: 24,
    reb: 15,
    ast: 9,
    fpts: 61.5,
  },
  {
    id: '4',
    name: 'Jayson Tatum',
    firstName: 'Jayson',
    lastName: 'Tatum',
    position: 'PF',
    teamLogo: 'https://cdn.nba.com/logos/nba/1610612738/global/L/logo.svg',
    avatar: 'https://cdn.nba.com/headshots/nba/latest/1040x760/1628369.png',
    status: 'FINAL' as const,
    pts: 30,
    reb: 7,
    ast: 3,
    fpts: 46.1,
  },
  {
    id: '5',
    name: 'Luka Doncic',
    firstName: 'Luka',
    lastName: 'Doncic',
    position: 'SG',
    teamLogo: 'https://cdn.nba.com/logos/nba/1610612742/global/L/logo.svg',
    avatar: 'https://cdn.nba.com/headshots/nba/latest/1040x760/1629029.png',
    status: 'LIVE' as const,
    pts: 41,
    reb: 5,
    ast: 8,
    fpts: 63.0,
  },
];

const MOCK_LEADERBOARD = [
  {
    rank: 1,
    name: 'DunkMaster_99',
    score: 310.5,
    rankChange: 'up' as const,
    isLive: true,
  },
  {
    rank: 2,
    name: 'HoopsFanatic',
    score: 295.0,
    rankChange: 'down' as const,
    isLive: true,
  },
  {
    rank: 3,
    name: 'You',
    score: 283.2,
    rankChange: 'up' as const,
    isCurrentUser: true,
    isLive: true,
  },
  {
    rank: 4,
    name: 'CrossoverQueen',
    score: 268.4,
    rankChange: 'down' as const,
    isLive: true,
  },
  {
    rank: 5,
    name: 'TheBeardFan',
    score: 255.1,
    rankChange: 'up' as const,
    isLive: true,
  },
];

export function MatchupsPageClient() {
  const totalScore = MOCK_STARTING_FIVE.reduce((sum, player) => sum + player.fpts, 0);

  const handleRefresh = () => {
    // TODO: Implement refresh logic
    console.log('Refreshing leaderboard...');
  };

  return (
    <div className="space-y-6 pb-24">
      {/* MY STARTING 5 Section */}
      <StartingFiveSection players={MOCK_STARTING_FIVE} totalScore={totalScore} />

      {/* FRIENDS LEADERBOARD Section */}
      <FriendsLeaderboardSection entries={MOCK_LEADERBOARD} onRefresh={handleRefresh} />
    </div>
  );
}
