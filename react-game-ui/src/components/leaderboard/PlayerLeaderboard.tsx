import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useInfinitePlayerStats } from '@/hooks/useInfinitePlayerStats';
import type { PlayerSeasonStats } from '@/types/nba';
import { DEFAULT_SEASON, PLAYER_SORT_CATEGORIES } from '@/config/constants';
import type { PlayerSortCategory } from '@/config/constants';

interface SortOption {
  label: string;
  value: PlayerSortCategory;
}

const SORT_OPTIONS: SortOption[] = [
  { label: 'Fantasy', value: PLAYER_SORT_CATEGORIES.FANTASY_AVG },
  { label: 'PTS', value: PLAYER_SORT_CATEGORIES.PTS },
  { label: 'REB', value: PLAYER_SORT_CATEGORIES.REB },
  { label: 'AST', value: PLAYER_SORT_CATEGORIES.AST },
  { label: 'STL', value: PLAYER_SORT_CATEGORIES.STL },
  { label: 'BLK', value: PLAYER_SORT_CATEGORIES.BLK },
];

interface PlayerLeaderboardProps {
  season?: string;
}

/**
 * Player Leaderboard Component
 * 
 * Matches the exact UI style of the Teams tab for consistency.
 * Uses the same sidebar styling, list item layout, and loading states.
 */
export function PlayerLeaderboard({ season = DEFAULT_SEASON }: PlayerLeaderboardProps) {
  const navigate = useNavigate();
  const [selectedSort, setSelectedSort] = useState<PlayerSortCategory>(PLAYER_SORT_CATEGORIES.FANTASY_AVG);

  const {
    stats,
    loading,
    hasMore,
    error,
    loadMore,
  } = useInfinitePlayerStats({
    sortBy: selectedSort,
    season,
  });


  const getStatValue = (stat: PlayerSeasonStats, category: PlayerSortCategory): number => {
    switch (category) {
      case 'fantasy_avg':
        return stat.fantasy_avg;
      case 'pts':
        return stat.pts;
      case 'reb':
        return stat.reb;
      case 'ast':
        return stat.ast;
      case 'stl':
        return stat.stl;
      case 'blk':
        return stat.blk;
      default:
        return 0;
    }
  };

  const formatStatValue = (value: number): string => {
    return value.toFixed(1);
  };

  const handlePlayerClick = (stat: PlayerSeasonStats) => {
    if (stat.player?.id) {
      navigate(`/player/${stat.player.id}`);
    }
  };

  return (
    <div className="flex-1 flex overflow-hidden h-full">
      {/* Left Sidebar (25% width) - Matching Teams tab style */}
      <div className="w-1/4 border-r border-brand-card-border bg-brand-dark/50">
        <div className="h-full flex flex-col py-2">
          {SORT_OPTIONS.map((option) => {
            const isActive = selectedSort === option.value;
            return (
              <button
                key={option.value}
                onClick={() => setSelectedSort(option.value)}
                className={cn(
                  'w-full px-3 py-3 text-left text-sm font-medium transition-colors border-l-2',
                  isActive
                    ? 'bg-brand-card/50 text-brand-blue border-brand-blue'
                    : 'text-brand-text-dim border-transparent hover:text-brand-text-light hover:bg-brand-card/30'
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Right Content Area (75% width) */}
      <div className="flex-1 overflow-y-auto">
        {/* Loading State - Matching Teams tab style */}
        {loading && stats.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <p className="text-brand-text-dim">Loading standings...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="flex flex-col items-center justify-center h-full p-4">
            <p className="text-red-500 mb-2">Error loading player stats</p>
            <p className="text-brand-text-dim text-sm mb-4">{error.message}</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && stats.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <p className="text-brand-text-dim">No player stats available</p>
          </div>
        )}

        {/* Player List - Matching TeamRankItem style */}
        {stats.length > 0 && (
          <div className="divide-y divide-brand-card-border min-w-0">
            {stats.map((stat, index) => (
              <div
                key={`${stat.player_id}-${index}`}
                className={cn(
                  'grid items-center gap-2.5 px-3 py-3 transition-colors',
                  // Grid layout matching TeamRankItem: rank | avatar | name | stat value
                  'grid-cols-[32px_42px_minmax(80px,1fr)_auto]',
                  'hover:bg-accent/50 cursor-pointer active:bg-accent/70'
                )}
                onClick={() => handlePlayerClick(stat)}
              >
                {/* Rank - Matching TeamRankItem style */}
                <div className="flex items-center justify-center">
                  <span className="text-sm font-bold text-muted-foreground leading-none">
                    {index + 1}
                  </span>
                </div>

                {/* Avatar - Matching TeamRankItem style */}
                <div className="flex items-center justify-center flex-shrink-0">
                  {stat.player?.headshot_url ? (
                    <img
                      src={stat.player.headshot_url}
                      alt={stat.player.full_name}
                      className="w-8 h-8 rounded-full object-cover border border-brand-card-border"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-brand-card border border-brand-card-border flex items-center justify-center">
                      <span className="text-[10px] font-bold text-brand-text-dim leading-none">
                        {stat.player?.full_name?.charAt(0).toUpperCase() || '?'}
                      </span>
                    </div>
                  )}
                </div>

                {/* Player Name + Team - Matching TeamRankItem style */}
                <div className="min-w-[80px] flex flex-col justify-center overflow-hidden">
                  <p className="text-white font-semibold text-sm leading-tight break-words">
                    {stat.player?.full_name || 'Unknown Player'}
                  </p>
                  {stat.team?.code && (
                    <p className="text-xs text-brand-text-dim leading-tight">
                      {stat.team.code}
                    </p>
                  )}
                </div>

                {/* Big Stat Value - Right aligned, large font */}
                <div className="flex items-center justify-end flex-shrink-0">
                  <p className="text-white text-lg font-bold leading-none whitespace-nowrap">
                    {formatStatValue(getStatValue(stat, selectedSort))}
                  </p>
                </div>
              </div>
            ))}

            {/* Load More Button - Subtle style matching app theme */}
            {hasMore && (
              <div className="px-4 py-3 border-t border-brand-card-border">
                <button
                  onClick={() => loadMore()}
                  disabled={loading}
                  className={cn(
                    'w-full py-2.5 text-sm font-medium transition-colors rounded-md',
                    loading
                      ? 'text-brand-text-dim cursor-not-allowed'
                      : 'text-brand-blue hover:bg-brand-card/30 active:bg-brand-card/50 border border-brand-card-border hover:border-brand-card-border-active'
                  )}
                >
                  {loading ? 'Loading...' : 'Load More'}
                </button>
              </div>
            )}

            {/* End of list indicator */}
            {!hasMore && stats.length > 0 && (
              <div className="px-4 py-3 border-t border-brand-card-border">
                <div className="text-center">
                  <p className="text-brand-text-dim text-xs">No more players</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
