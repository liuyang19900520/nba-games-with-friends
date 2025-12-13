import type { TeamDetail } from '@/types';
import { PlayerStatCard } from './PlayerStatCard';

interface TeamDetailViewProps {
  team: TeamDetail;
}

export function TeamDetailView({ team }: TeamDetailViewProps) {
  return (
    <div className="px-4 space-y-6">
      {/* Team Summary Card */}
      <div className="bg-brand-card border-2 border-purple-500/50 rounded-xl p-4 shadow-glow-blue">
        <div className="flex items-center gap-4 mb-4">
          {team.logo && (
            <img
              src={team.logo}
              alt={team.name}
              className="w-16 h-16 rounded-full object-cover border-2 border-brand-card-border"
            />
          )}
          <div className="flex-1">
            <h2 className="text-lg font-bold text-white uppercase">{team.name}</h2>
            <p className="text-sm text-brand-text-dim mt-1">
              Rank #{team.rank} | Record {team.record}
            </p>
          </div>
        </div>

        <div className="border-t border-brand-card-border pt-4 mt-4">
          <h3 className="text-sm font-semibold text-white uppercase mb-4">Summary</h3>
          <div className="grid grid-cols-3 gap-4">
            {/* PPG */}
            <div className="flex flex-col items-center">
              <div className="w-20 h-12 mb-2 relative">
                {/* Simple line chart visualization */}
                <svg viewBox="0 0 80 48" className="w-full h-full">
                  <polyline
                    points="5,40 15,30 25,35 35,25 45,20 55,15 65,10 75,8"
                    fill="none"
                    stroke="#F5A623"
                    strokeWidth="2"
                  />
                </svg>
              </div>
              <p className="text-xs text-brand-text-dim mb-1">PPG</p>
              <p className="text-lg font-bold text-brand-orange">{team.stats.ppg}</p>
            </div>

            {/* RPG */}
            <div className="flex flex-col items-center">
              <div className="w-20 h-12 mb-2 relative">
                {/* Simple bar chart visualization */}
                <svg viewBox="0 0 80 48" className="w-full h-full">
                  <rect x="10" y="35" width="8" height="13" fill="#6EE2F5" />
                  <rect x="22" y="30" width="8" height="18" fill="#6EE2F5" />
                  <rect x="34" y="25" width="8" height="23" fill="#6EE2F5" />
                  <rect x="46" y="20" width="8" height="28" fill="#6EE2F5" />
                  <rect x="58" y="28" width="8" height="20" fill="#6EE2F5" />
                </svg>
              </div>
              <p className="text-xs text-brand-text-dim mb-1">RPG</p>
              <p className="text-lg font-bold text-brand-blue">{team.stats.rpg}</p>
            </div>

            {/* APG */}
            <div className="flex flex-col items-center">
              <div className="w-20 h-12 mb-2 relative">
                {/* Simple wavy line visualization */}
                <svg viewBox="0 0 80 48" className="w-full h-full">
                  <path
                    d="M5,30 Q15,20 25,30 T45,30 T65,30"
                    fill="none"
                    stroke="#10B981"
                    strokeWidth="2"
                  />
                  <path
                    d="M5,35 Q15,25 25,35 T45,35 T65,35"
                    fill="none"
                    stroke="#10B981"
                    strokeWidth="2"
                  />
                </svg>
              </div>
              <p className="text-xs text-brand-text-dim mb-1">APG</p>
              <p className="text-lg font-bold text-green-500">{team.stats.apg}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Roster & Performance */}
      <div>
        <h3 className="text-lg font-bold text-white uppercase mb-4">Roster & Performance</h3>
        <div className="space-y-3">
          {team.players.map((player) => (
            <PlayerStatCard key={player.id} player={player} />
          ))}
        </div>
      </div>
    </div>
  );
}

