'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import type { PlayerStats } from '@/types';

interface PlayerStatCardProps {
  player: PlayerStats;
}

export function PlayerStatCard({ player }: PlayerStatCardProps) {
  const router = useRouter();

  const handleClick = () => {
    router.push(`/player/${player.id}`);
  };

  const latestFantasyScore = player.fantasyScore || 0;

  const splitName = (
    fullName?: string
  ): { firstName: string; lastName: string } => {
    const safe = (fullName ?? "").trim();
    if (!safe) {
      return { firstName: "", lastName: "" };
    }

    const parts = safe.split(/\s+/);
    const first = parts[0] ?? "";
    if (parts.length === 1) {
      return { firstName: first, lastName: "" };
    }

    const firstName = first;
    const lastName = parts.slice(1).join(" ");
    return { firstName, lastName };
  };

  const { firstName, lastName } = splitName(player.name);

  const getFantasyScoreColor = (score: number) => {
    if (score >= 30) return 'text-green-400';
    if (score >= 20) return 'text-brand-blue';
    if (score >= 15) return 'text-brand-orange';
    return 'text-brand-text-dim';
  };

  const fantasyColor = getFantasyScoreColor(latestFantasyScore);

  return (
    <div
      className="bg-brand-card border-2 border-brand-card-border rounded-xl p-6 hover:border-brand-card-border-active transition-colors cursor-pointer"
      onClick={handleClick}
    >
      <div className="flex items-center gap-4">
        <div className="flex flex-col items-center justify-center flex-shrink-0 h-full w-24">
          <Image
            src={player.avatar}
            alt={player.name}
            width={64}
            height={64}
            className="w-16 h-16 rounded-full object-cover border-2 border-brand-card-border mb-2"
          />
          <div className="text-center mb-1 min-h-[2.5rem] flex flex-col justify-center">
            {lastName ? (
              <>
                <h4 className="text-sm font-bold text-white leading-tight">
                  {firstName}
                </h4>
                <h4 className="text-sm font-bold text-white leading-tight">
                  {lastName}
                </h4>
              </>
            ) : (
              <h4 className="text-sm font-bold text-white leading-tight">
                {firstName}
              </h4>
            )}
          </div>
          <p className="text-xs text-brand-text-dim uppercase font-semibold">
            {player.position}
          </p>
        </div>

        <div className="flex-1 min-w-0">
          <div
            className="overflow-x-auto -mx-2 px-2 scrollbar-hide"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            <div className="flex items-center gap-2 min-w-max">
              <div className="flex flex-col items-center p-3 border border-brand-blue/30 rounded-lg bg-brand-card/30 flex-1">
                <div className="w-6 h-6 mb-1 flex items-center justify-center">
                  <svg viewBox="0 0 24 24" className="w-4 h-4 text-brand-blue">
                    <path d="M12 2L2 7l10 5 10-5-10-5z" fill="none" stroke="currentColor" strokeWidth="2" />
                    <path d="M2 17l10 5 10-5M2 12l10 5 10-5" fill="none" stroke="currentColor" strokeWidth="2" />
                  </svg>
                </div>
                <p className="text-xs text-brand-text-dim mb-0.5">Fantasy</p>
                <p className={`text-base font-bold ${fantasyColor}`}>
                  {latestFantasyScore.toFixed(1)}
                </p>
              </div>

              <div className="flex flex-col items-center p-3 border border-brand-orange/30 rounded-lg bg-brand-card/30 flex-1">
                <div className="w-6 h-6 mb-1 flex items-center justify-center">
                  <svg viewBox="0 0 24 24" className="w-4 h-4 text-brand-orange">
                    <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="2" />
                    <path d="M12 4v8l6 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </div>
                <p className="text-xs text-brand-text-dim mb-0.5">PTS</p>
                <p className="text-base font-bold text-brand-orange">{player.pts.toFixed(1)}</p>
              </div>

              <div className="flex flex-col items-center p-3 border border-brand-blue/30 rounded-lg bg-brand-card/30 flex-1">
                <div className="w-6 h-6 mb-1 flex items-center justify-center">
                  <svg viewBox="0 0 24 24" className="w-4 h-4 text-brand-blue">
                    <rect x="6" y="6" width="12" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
                    <path d="M8 10h8M8 14h8" stroke="currentColor" strokeWidth="2" />
                  </svg>
                </div>
                <p className="text-xs text-brand-text-dim mb-0.5">REB</p>
                <p className="text-base font-bold text-brand-blue">{player.reb.toFixed(1)}</p>
              </div>

              <div className="flex flex-col items-center p-3 border border-green-500/30 rounded-lg bg-brand-card/30 flex-1">
                <div className="w-6 h-6 mb-1 flex items-center justify-center">
                  <svg viewBox="0 0 24 24" className="w-4 h-4 text-green-500">
                    <path d="M12 2L2 12l10 10 10-10L12 2z" fill="none" stroke="currentColor" strokeWidth="2" />
                    <path d="M8 12h8" stroke="currentColor" strokeWidth="2" />
                  </svg>
                </div>
                <p className="text-xs text-brand-text-dim mb-0.5">AST</p>
                <p className="text-base font-bold text-green-500">{player.ast.toFixed(1)}</p>
              </div>

              <div className="flex flex-col items-center p-3 border border-purple-500/30 rounded-lg bg-brand-card/30 flex-1">
                <div className="w-6 h-6 mb-1 flex items-center justify-center">
                  <svg viewBox="0 0 24 24" className="w-4 h-4 text-purple-400">
                    <path d="M12 2L2 7l10 5 10-5-10-5z" fill="none" stroke="currentColor" strokeWidth="2" />
                    <path d="M2 17l10 5 10-5M2 12l10 5 10-5" fill="none" stroke="currentColor" strokeWidth="2" />
                  </svg>
                </div>
                <p className="text-xs text-brand-text-dim mb-0.5">STL</p>
                <p className="text-base font-bold text-purple-400">{(player.stl || 0).toFixed(1)}</p>
              </div>

              <div className="flex flex-col items-center p-3 border border-red-500/30 rounded-lg bg-brand-card/30 flex-1">
                <div className="w-6 h-6 mb-1 flex items-center justify-center">
                  <svg viewBox="0 0 24 24" className="w-4 h-4 text-red-400">
                    <rect x="4" y="4" width="16" height="16" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
                    <path d="M9 9h6v6H9z" fill="currentColor" opacity="0.5" />
                  </svg>
                </div>
                <p className="text-xs text-brand-text-dim mb-0.5">BLK</p>
                <p className="text-base font-bold text-red-400">{(player.blk || 0).toFixed(1)}</p>
              </div>

              <div className="flex flex-col items-center p-3 border border-yellow-500/30 rounded-lg bg-brand-card/30 flex-1">
                <div className="w-6 h-6 mb-1 flex items-center justify-center">
                  <svg viewBox="0 0 24 24" className="w-4 h-4 text-yellow-400">
                    <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="2" />
                    <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </div>
                <p className="text-xs text-brand-text-dim mb-0.5">TOV</p>
                <p className="text-base font-bold text-yellow-400">{(player.tov || 0).toFixed(1)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
