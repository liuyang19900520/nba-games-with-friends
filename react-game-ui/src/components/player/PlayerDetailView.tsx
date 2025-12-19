import type { PlayerDetail } from '@/types';

import { LeagueComparisonRadar } from './LeagueComparisonRadar';
import { RecentGamesTable } from './RecentGamesTable';

interface PlayerDetailViewProps {
  player: PlayerDetail;
}

export function PlayerDetailView({ player }: PlayerDetailViewProps) {
  const fantasyScore = player.fantasyScore || 0;

  const getFantasyScoreColor = (score: number) => {
    if (score >= 30) return 'text-green-400';
    if (score >= 20) return 'text-brand-blue';
    if (score >= 15) return 'text-brand-orange';
    return 'text-brand-text-dim';
  };

  const fantasyColor = getFantasyScoreColor(fantasyScore);

  return (
    <div className="px-4 space-y-6 pb-6">
      <div className="flex items-center gap-6 pt-4">
        <div className="relative flex-shrink-0">
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-brand-blue via-purple-500 to-brand-blue opacity-60 blur-md animate-pulse" />
          <img
            src={player.avatar}
            alt={player.name}
            className="relative w-24 h-24 rounded-full object-cover border-4 border-brand-dark z-10"
          />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 bg-brand-blue rounded-full z-20" />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2 h-2 bg-purple-500 rounded-full z-20" />
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-2 h-2 bg-brand-blue rounded-full z-20" />
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 bg-purple-500 rounded-full z-20" />
        </div>

        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-bold text-white uppercase mb-1">
            {player.name}
          </h2>
          <p className="text-sm text-brand-text-dim mb-1">
            {player.team}
          </p>
          <p className="text-sm text-brand-text-dim">
            {player.position} {player.jerseyNumber}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto -mx-4 px-4 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}>
        <div className="flex gap-4 min-w-max pr-4">
          <div className="flex flex-col min-w-[80px] flex-shrink-0">
            <p className="text-xs text-brand-text-dim mb-1 uppercase">Fantasy</p>
            <p className={`text-2xl font-bold ${fantasyColor}`}>
              {fantasyScore.toFixed(1)}
            </p>
          </div>

          <div className="flex flex-col min-w-[80px] flex-shrink-0">
            <p className="text-xs text-brand-text-dim mb-1 uppercase">PTS</p>
            <p className="text-2xl font-bold text-white">{player.ppg.toFixed(1)}</p>
          </div>

          <div className="flex flex-col min-w-[80px] flex-shrink-0">
            <p className="text-xs text-brand-text-dim mb-1 uppercase">REB</p>
            <p className="text-2xl font-bold text-white">{player.rpg.toFixed(1)}</p>
          </div>

          <div className="flex flex-col min-w-[80px] flex-shrink-0">
            <p className="text-xs text-brand-text-dim mb-1 uppercase">AST</p>
            <p className="text-2xl font-bold text-white">{player.apg.toFixed(1)}</p>
          </div>

          <div className="flex flex-col min-w-[80px] flex-shrink-0">
            <p className="text-xs text-brand-text-dim mb-1 uppercase">STL</p>
            <p className="text-2xl font-bold text-white">{(player.stl || 0).toFixed(1)}</p>
          </div>

          <div className="flex flex-col min-w-[80px] flex-shrink-0">
            <p className="text-xs text-brand-text-dim mb-1 uppercase">BLK</p>
            <p className="text-2xl font-bold text-white">{(player.blk || 0).toFixed(1)}</p>
          </div>

          <div className="flex flex-col min-w-[80px] flex-shrink-0">
            <p className="text-xs text-brand-text-dim mb-1 uppercase">TOV</p>
            <p className="text-2xl font-bold text-white">{(player.tov || 0).toFixed(1)}</p>
          </div>
        </div>
      </div>

      {/* Recent 10 Games */}
      {player.recentGames && player.recentGames.length > 0 && (
        <RecentGamesTable games={player.recentGames} />
      )}

      {/* Versus League Averages */}
      <div className="bg-brand-card border border-brand-card-border rounded-xl p-4">
        <h4 className="text-sm font-bold text-white uppercase mb-4">Versus League Averages</h4>
        <LeagueComparisonRadar comparison={player.leagueComparison} />
      </div>
    </div>
  );
}

