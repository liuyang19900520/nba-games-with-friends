'use client';

import { RefreshCw } from 'lucide-react';
import Image from 'next/image';

interface LeaderboardEntry {
  rank: number;
  name: string;
  avatar?: string;
  score: number;
  rankChange: 'up' | 'down' | 'same';
  isCurrentUser?: boolean;
  isLive?: boolean;
}

interface FriendsLeaderboardSectionProps {
  entries: LeaderboardEntry[];
  onRefresh?: () => void;
}

export function FriendsLeaderboardSection({
  entries,
  onRefresh,
}: FriendsLeaderboardSectionProps) {
  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-white">FRIENDS LEADERBOARD</h2>
        <button
          onClick={onRefresh}
          className="p-2 hover:bg-brand-card rounded-lg transition-colors"
          aria-label="Refresh leaderboard"
        >
          <RefreshCw className="w-5 h-5 text-brand-blue" />
        </button>
      </div>

      {/* Leaderboard List */}
      <div className="space-y-2">
        {entries.map((entry) => (
          <div
            key={entry.rank}
            className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
              entry.isCurrentUser
                ? 'bg-brand-blue/20 border-brand-blue'
                : 'bg-brand-card border-brand-card-border'
            }`}
          >
            {/* Rank with Arrow */}
            <div className="flex items-center gap-2 min-w-[60px]">
              <span className="text-lg font-bold text-white">{entry.rank}</span>
              {entry.rankChange === 'up' && (
                <span className="text-green-400 text-sm">↑</span>
              )}
              {entry.rankChange === 'down' && (
                <span className="text-red-400 text-sm">↓</span>
              )}
              {entry.isLive && (
                <span className="text-xs bg-red-500 text-white px-1.5 py-0.5 rounded">
                  LIVE
                </span>
              )}
            </div>

            {/* Avatar */}
            <div className="w-10 h-10 rounded-full overflow-hidden bg-brand-dark flex-shrink-0">
              {entry.avatar ? (
                <Image
                  src={entry.avatar}
                  alt={entry.name}
                  width={40}
                  height={40}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-brand-blue/20 flex items-center justify-center">
                  <span className="text-brand-blue font-semibold text-sm">
                    {entry.name.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
            </div>

            {/* Name */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className={`font-semibold truncate ${
                    entry.isCurrentUser ? 'text-brand-blue' : 'text-white'
                  }`}
                >
                  {entry.name}
                </span>
                {entry.isLive && (
                  <span className="text-xs bg-red-500 text-white px-1.5 py-0.5 rounded">
                    LIVE
                  </span>
                )}
              </div>
            </div>

            {/* Score */}
            <div className="text-right flex-shrink-0">
              <span className="text-lg font-bold text-white">
                {entry.score.toFixed(1)}
              </span>
              <span className="text-xs text-brand-text-dim ml-1">FPTS</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
