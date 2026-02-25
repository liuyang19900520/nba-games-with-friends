import Image from 'next/image';
import { cn } from '@/lib/utils';
import type { LeaderboardEntry } from '@/types';

interface TeamRankItemProps {
  team: LeaderboardEntry;
  onClick?: () => void;
}

export function TeamRankItem({ team, onClick }: TeamRankItemProps) {
  // Format win percentage to 3 decimal places (e.g., 0.750 -> ".750")
  const formatWinPct = (winPct?: number): string => {
    if (winPct === undefined) return '-';
    return winPct.toFixed(3).substring(1); // Remove leading "0"
  };

  // Determine streak color
  const getStreakColor = (streak?: string): string => {
    if (!streak) return 'text-brand-text-dim';
    if (streak.startsWith('W')) return 'text-green-500';
    if (streak.startsWith('L')) return 'text-red-500';
    return 'text-brand-text-dim';
  };

  // Determine if team logo exists (prefer logoUrl, fallback to logo)
  const teamLogo = team.logoUrl || team.logo;

  return (
    <div
      className={cn(
        'grid items-center gap-2.5 px-3 py-3 transition-colors',
        // Optimized column widths: rank | logo | name (flexible) | record | win% | streak
        // Reduced padding and gaps, gave more space to team name
        'grid-cols-[32px_42px_minmax(80px,1fr)_52px_48px_45px]',
        onClick
          ? 'hover:bg-accent/50 cursor-pointer active:bg-accent/70'
          : 'hover:bg-accent/50'
      )}
      onClick={onClick}
    >
      {/* Rank - Fixed width, centered */}
      <div className="flex items-center justify-center">
        <span className="text-sm font-bold text-muted-foreground leading-none">
          {team.rank}
        </span>
      </div>

      {/* Logo - Fixed width */}
      <div className="flex items-center justify-center flex-shrink-0">
        {teamLogo ? (
          <Image
            src={teamLogo}
            alt={team.name}
            width={32}
            height={32}
            className="w-8 h-8 rounded-full object-cover border border-brand-card-border"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-brand-card border border-brand-card-border flex items-center justify-center">
            <span className="text-[10px] font-bold text-brand-text-dim leading-none">
              {team.name.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
      </div>

      {/* Team Name - Flexible width, can wrap or scroll, no truncate */}
      <div className="min-w-[80px] flex items-center overflow-hidden">
        <p className="text-white font-semibold text-sm leading-tight break-words">
          {team.name}
        </p>
      </div>

      {/* Record - Fixed width, right-aligned */}
      <div className="flex items-center justify-end">
        {team.wins !== undefined && team.losses !== undefined ? (
          <p className="text-white text-sm font-medium leading-none whitespace-nowrap">
            {team.wins}-{team.losses}
          </p>
        ) : (
          <p className="text-brand-text-dim text-sm leading-none">-</p>
        )}
      </div>

      {/* Win % - Fixed width, right-aligned */}
      <div className="flex items-center justify-end">
        <p className="text-brand-text-dim text-xs font-mono leading-none">
          {formatWinPct(team.winPct)}
        </p>
      </div>

      {/* Streak - Fixed width, right-aligned */}
      <div className="flex items-center justify-end">
        <p className={cn('text-xs font-medium leading-none whitespace-nowrap', getStreakColor(team.streak))}>
          {team.streak || '-'}
        </p>
      </div>
    </div>
  );
}

