import Image from 'next/image';
import type { TeamDetail } from '@/types';

import { PlayerStatCard } from './PlayerStatCard';

interface TeamDetailViewProps {
  team: TeamDetail;
}

export function TeamDetailView({ team }: TeamDetailViewProps) {
  return (
    <div className="px-4 space-y-6">
      <div className="bg-brand-card border-2 border-purple-500/50 rounded-xl p-4 shadow-glow-blue">
        <div className="flex items-center gap-4 mb-4">
          {team.logo && (
            <Image
              src={team.logo}
              alt={team.name}
              width={64}
              height={64}
              priority
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
          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col items-center p-3 border-2 border-brand-orange/50 rounded-lg bg-brand-card/50 shadow-[0_0_10px_rgba(245,166,35,0.3)]">
              <p className="text-xs text-brand-text-dim mb-1">PPG</p>
              <p className="text-lg font-bold text-brand-orange">{team.stats.ppg.toFixed(1)}</p>
            </div>

            <div className="flex flex-col items-center p-3 border-2 border-brand-blue/50 rounded-lg bg-brand-card/50 shadow-[0_0_10px_rgba(110,226,245,0.3)]">
              <p className="text-xs text-brand-text-dim mb-1">RPG</p>
              <p className="text-lg font-bold text-brand-blue">{team.stats.rpg.toFixed(1)}</p>
            </div>

            <div className="flex flex-col items-center p-3 border-2 border-green-500/50 rounded-lg bg-brand-card/50 shadow-[0_0_10px_rgba(16,185,129,0.3)]">
              <p className="text-xs text-brand-text-dim mb-1">APG</p>
              <p className="text-lg font-bold text-green-500">{team.stats.apg.toFixed(1)}</p>
            </div>

            <div className="flex flex-col items-center p-3 border-2 border-purple-500/50 rounded-lg bg-brand-card/50 shadow-[0_0_10px_rgba(168,85,247,0.3)]">
              <p className="text-xs text-brand-text-dim mb-1">STL</p>
              <p className="text-lg font-bold text-purple-400">{team.stats.stl.toFixed(1)}</p>
            </div>

            <div className="flex flex-col items-center p-3 border-2 border-red-500/50 rounded-lg bg-brand-card/50 shadow-[0_0_10px_rgba(239,68,68,0.3)]">
              <p className="text-xs text-brand-text-dim mb-1">BLK</p>
              <p className="text-lg font-bold text-red-400">{team.stats.blk.toFixed(1)}</p>
            </div>

            <div className="flex flex-col items-center p-3 border-2 border-yellow-500/50 rounded-lg bg-brand-card/50 shadow-[0_0_10px_rgba(234,179,8,0.3)]">
              <p className="text-xs text-brand-text-dim mb-1">TOV</p>
              <p className="text-lg font-bold text-yellow-400">{team.stats.tov.toFixed(1)}</p>
            </div>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-bold text-white uppercase mb-4">Roster & Performance</h3>
        <div className="space-y-4">
          {team.players.map((player) => (
            <PlayerStatCard key={player.id} player={player} />
          ))}
        </div>
      </div>
    </div>
  );
}

