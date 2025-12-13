import { cn } from '@/lib/utils';
import type { LeaderboardFilter } from '@/types';

interface LeaderboardSidebarProps {
  filters: LeaderboardFilter[];
  selectedFilter: LeaderboardFilter;
  onFilterSelect: (filter: LeaderboardFilter) => void;
}

export function LeaderboardSidebar({
  filters,
  selectedFilter,
  onFilterSelect,
}: LeaderboardSidebarProps) {
  return (
    <div className="h-full flex flex-col py-2">
      {filters.map((filter) => {
        const isActive = selectedFilter === filter;
        return (
          <button
            key={filter}
            onClick={() => onFilterSelect(filter)}
            className={cn(
              'w-full px-3 py-3 text-left text-sm font-medium transition-colors border-l-2',
              isActive
                ? 'bg-brand-card/50 text-brand-blue border-brand-blue'
                : 'text-brand-text-dim border-transparent hover:text-brand-text-light hover:bg-brand-card/30'
            )}
          >
            {filter}
          </button>
        );
      })}
    </div>
  );
}

