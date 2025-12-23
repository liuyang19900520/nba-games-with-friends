'use client';

import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import type { LeaderboardEntry, LeaderboardFilter } from '@/types';
import { TeamRankItem } from './TeamRankItem';

interface LeaderboardListProps {
  entries: LeaderboardEntry[];
  filter: LeaderboardFilter;
  type?: 'teams' | 'players';
}

const getFilterLabel = (filter: LeaderboardFilter): string => {
  const labels: Record<LeaderboardFilter, string> = {
    PTS: 'Points',
    REB: 'Rebounds',
    AST: 'Assists',
    WINS: 'Wins',
    LOSSES: 'Losses',
    East: 'Eastern Conference',
    West: 'Western Conference',
  };
  return labels[filter] || filter;
};

export function LeaderboardList({ entries, filter }: LeaderboardListProps) {
  const router = useRouter();

  // Filter entries based on selected filter
  const filteredEntries = entries.filter((entry) => {
    if (filter === 'East' || filter === 'West') {
      return entry.conference === filter;
    }
    return true; // For stat-based filters, show all (data already sorted)
  });

  const filterLabel = getFilterLabel(filter);

  const handleEntryClick = (entry: LeaderboardEntry) => {
    // Navigate to team page if it's a team entry
    if (entry.conference && (entry.wins !== undefined || entry.logo)) {
      router.push(`/team/${entry.id}`);
    }
    // Navigate to player page if it's a player entry (has team field and avatar)
    else if (entry.team && entry.avatar) {
      router.push(`/player/${entry.id}`);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-brand-dark/95 backdrop-blur-sm border-b border-brand-card-border px-4 py-3">
        <h2 className="text-lg font-semibold text-white">{filterLabel}</h2>
        <p className="text-xs text-brand-text-dim mt-1">{filteredEntries.length} entries</p>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {filteredEntries.length === 0 ? (
          <div className="flex items-center justify-center h-full text-brand-text-dim">
            <p>No data available</p>
          </div>
        ) : (
          <div className="divide-y divide-brand-card-border min-w-0">
            {filteredEntries.map((entry) => {
              // Use TeamRankItem for team entries (when conference exists and wins/losses are available)
              const isTeamEntry = entry.conference && (entry.wins !== undefined || entry.logo || entry.logoUrl);

              if (isTeamEntry) {
                return (
                  <TeamRankItem
                    key={entry.id}
                    team={entry}
                    onClick={() => handleEntryClick(entry)}
                  />
                );
              }

              // Use LeaderboardItem for player entries
              return (
                <LeaderboardItem
                  key={entry.id}
                  entry={entry}
                  filter={filter}
                  onClick={() => handleEntryClick(entry)}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

interface LeaderboardItemProps {
  entry: LeaderboardEntry;
  filter: LeaderboardFilter;
  onClick?: () => void;
}

function LeaderboardItem({ entry, filter, onClick }: LeaderboardItemProps) {
  const isTeamClickable = !!onClick && entry.conference && (entry.wins !== undefined || entry.logo);
  const isPlayerClickable = !!onClick && entry.team && entry.avatar;
  const isClickable = isTeamClickable || isPlayerClickable;
  const formatValue = (value: number, filter: LeaderboardFilter): string => {
    if (filter === 'WINS' || filter === 'LOSSES' || filter === 'East' || filter === 'West') {
      return value.toString();
    }
    return value.toFixed(1);
  };

  return (
    <div
      className={cn(
        'px-4 py-3 transition-colors',
        isClickable
          ? 'hover:bg-brand-card/30 cursor-pointer active:bg-brand-card/50'
          : 'hover:bg-brand-card/30'
      )}
      onClick={isClickable ? onClick : undefined}
    >
      <div className="flex items-center gap-3">
        {/* Rank */}
        <div className="flex-shrink-0 w-8 text-center">
          <span
            className={cn(
              'text-lg font-bold',
              entry.rank <= 3
                ? 'text-brand-orange'
                : 'text-brand-text-dim'
            )}
          >
            #{entry.rank}
          </span>
        </div>

        {/* Avatar/Logo */}
        <div className="flex-shrink-0">
          {entry.avatar ? (
            <img
              src={entry.avatar}
              alt={entry.name}
              className="w-10 h-10 rounded-full object-cover border-2 border-brand-card-border"
            />
          ) : entry.logo ? (
            <img
              src={entry.logo}
              alt={entry.name}
              className="w-10 h-10 rounded-full object-cover border-2 border-brand-card-border"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-brand-card border-2 border-brand-card-border flex items-center justify-center">
              <span className="text-xs font-bold text-brand-text-dim">
                {entry.name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-white font-medium text-sm truncate">{entry.name}</p>
              {entry.team && (
                <p className="text-xs text-brand-text-dim truncate">{entry.team}</p>
              )}
              {entry.conference && (
                <p className="text-xs text-brand-text-dim truncate">{entry.conference} Conference</p>
              )}
            </div>
            <div className="flex-shrink-0 ml-2 text-right">
              <p className="text-brand-blue font-bold text-lg">
                {formatValue(entry.value, filter)}
              </p>
              {(filter === 'WINS' || filter === 'East' || filter === 'West') && 'wins' in entry && entry.losses !== undefined && (
                <p className="text-xs text-brand-text-dim">
                  {entry.losses} L
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

