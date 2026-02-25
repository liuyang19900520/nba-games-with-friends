import type { RecentGame } from '@/types';

interface RecentGamesTableProps {
  games: RecentGame[];
}

export function RecentGamesTable({ games }: RecentGamesTableProps) {
  const getFantasyScoreColor = (score: number) => {
    if (score >= 50) return 'text-orange-400';
    if (score >= 40) return 'text-orange-500';
    if (score >= 30) return 'text-orange-600';
    return 'text-orange-300';
  };

  return (
    <div className="bg-brand-card border-2 border-orange-500/50 rounded-xl p-4 shadow-[0_0_10px_rgba(249,115,22,0.3)]">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-bold text-white uppercase">Recent 10 Games</h4>
        <svg className="w-5 h-5 text-brand-text-dim" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>

      <div className="overflow-x-auto -mx-4 px-4 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}>
        <div className="min-w-max">
          {/* Table Header */}
          <div className="flex gap-3 mb-2 pb-2 border-b border-orange-500/30">
            <div className="w-24 flex-shrink-0">
              <p className="text-xs font-bold text-white uppercase">Date</p>
            </div>
            <div className="w-20 flex-shrink-0">
              <p className="text-xs font-bold text-white uppercase">Opp</p>
            </div>
            <div className="w-12 flex-shrink-0">
              <p className="text-xs font-bold text-white uppercase">Min</p>
            </div>
            <div className="w-14 flex-shrink-0">
              <p className="text-xs font-bold text-white uppercase">PTS</p>
            </div>
            <div className="w-14 flex-shrink-0">
              <p className="text-xs font-bold text-white uppercase">REB</p>
            </div>
            <div className="w-14 flex-shrink-0">
              <p className="text-xs font-bold text-white uppercase">AST</p>
            </div>
            <div className="w-14 flex-shrink-0">
              <p className="text-xs font-bold text-white uppercase">STL</p>
            </div>
            <div className="w-14 flex-shrink-0">
              <p className="text-xs font-bold text-white uppercase">BLK</p>
            </div>
            <div className="w-14 flex-shrink-0">
              <p className="text-xs font-bold text-white uppercase">TOV</p>
            </div>
            <div className="w-20 flex-shrink-0">
              <p className="text-xs font-bold text-white uppercase">Fantasy</p>
            </div>
          </div>

          {/* Table Rows */}
          <div className="space-y-2">
            {games.map((game, index) => (
              <div key={index} className="flex gap-3">
                <div className="w-24 flex-shrink-0">
                  <p className="text-xs text-white">{game.date}</p>
                </div>
                <div className="w-20 flex-shrink-0">
                  <p className="text-xs text-white">{game.opponent}</p>
                </div>
                <div className="w-12 flex-shrink-0">
                  <p className="text-xs text-white">{game.min}</p>
                </div>
                <div className="w-14 flex-shrink-0">
                  <p className="text-xs text-white">{game.pts}</p>
                </div>
                <div className="w-14 flex-shrink-0">
                  <p className="text-xs text-white">{game.reb}</p>
                </div>
                <div className="w-14 flex-shrink-0">
                  <p className="text-xs text-white">{game.ast}</p>
                </div>
                <div className="w-14 flex-shrink-0">
                  <p className="text-xs text-white">{game.stl}</p>
                </div>
                <div className="w-14 flex-shrink-0">
                  <p className="text-xs text-white">{game.blk}</p>
                </div>
                <div className="w-14 flex-shrink-0">
                  <p className="text-xs text-white">{game.tov}</p>
                </div>
                <div className="w-20 flex-shrink-0">
                  <p className={`text-xs font-bold ${getFantasyScoreColor(game.fantasy)}`}>
                    {game.fantasy.toFixed(1)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
