'use client';

import { StartingFiveSection } from './StartingFiveSection';
import { FriendsLeaderboardSection } from './FriendsLeaderboardSection';
import type { MatchupPlayer } from '@/lib/db/matchups';

interface MatchupsPageClientProps {
  lineupData: {
    players: MatchupPlayer[];
    totalScore: number;
    lineupId: number | null;
  } | null;
}

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

export function MatchupsPageClient({ lineupData }: MatchupsPageClientProps) {
  const players = lineupData?.players || [];
  const totalScore = lineupData?.totalScore || 0;

  const handleRefresh = () => {
    // TODO: Implement refresh logic
    console.log('Refreshing leaderboard...');
  };

  // Show empty state if no lineup
  if (!lineupData || players.length === 0) {
    return (
      <div className="space-y-6 pb-24">
        <div className="bg-brand-card border border-brand-card-border rounded-xl p-6 text-center">
          <p className="text-brand-text-dim mb-2">
            No lineup found for the selected date.
          </p>
          <p className="text-sm text-brand-text-dim">
            Please select your lineup on the{' '}
            <a href="/lineup" className="text-brand-blue underline font-medium">
              Lineup
            </a>{' '}
            page and submit it.
          </p>
        </div>
        <FriendsLeaderboardSection entries={MOCK_LEADERBOARD} onRefresh={handleRefresh} />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      {/* MY STARTING 5 Section */}
      <StartingFiveSection players={players} totalScore={totalScore} />

      {/* FRIENDS LEADERBOARD Section */}
      <FriendsLeaderboardSection entries={MOCK_LEADERBOARD} onRefresh={handleRefresh} />
    </div>
  );
}
