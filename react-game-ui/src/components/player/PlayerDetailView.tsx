import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { PlayerDetail } from '@/types';
import { ClutchTimeChart } from './ClutchTimeChart';
import { ShotChart } from './ShotChart';
import { LeagueComparisonRadar } from './LeagueComparisonRadar';

interface PlayerDetailViewProps {
  player: PlayerDetail;
}

export function PlayerDetailView({ player }: PlayerDetailViewProps) {
  const [isFollowed, setIsFollowed] = useState(player.isFollowed || false);

  return (
    <div className="px-4 space-y-6 pb-6">
      {/* Player Header Section */}
      <div className="flex items-start gap-4 pt-4">
        {/* Player Avatar with Glow Ring */}
        <div className="relative flex-shrink-0">
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-brand-blue via-purple-500 to-brand-blue opacity-60 blur-md animate-pulse" />
          <img
            src={player.avatar}
            alt={player.name}
            className="relative w-24 h-24 rounded-full object-cover border-4 border-brand-dark z-10"
          />
          {/* Small nodes on the ring */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 bg-brand-blue rounded-full z-20" />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2 h-2 bg-purple-500 rounded-full z-20" />
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-2 h-2 bg-brand-blue rounded-full z-20" />
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 bg-purple-500 rounded-full z-20" />
        </div>

        {/* Player Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-bold text-white uppercase mb-1 truncate">
                {player.name}
              </h2>
              <p className="text-sm text-brand-text-dim mb-1">
                {player.team}
              </p>
              <p className="text-sm text-brand-text-dim">
                {player.position} {player.jerseyNumber}
              </p>
            </div>
            <button
              onClick={() => setIsFollowed(!isFollowed)}
              className={cn(
                'px-4 py-1.5 rounded-full text-sm font-medium transition-colors flex-shrink-0',
                isFollowed
                  ? 'bg-brand-blue text-white'
                  : 'bg-brand-blue/20 text-brand-blue border border-brand-blue'
              )}
            >
              {isFollowed ? 'FOLLOWING' : 'FOLLOW'}
            </button>
          </div>

          {/* Key Stats */}
          <div className="grid grid-cols-3 gap-4 mt-4">
            <div>
              <p className="text-xs text-brand-text-dim mb-1">PPG</p>
              <p className="text-2xl font-bold text-white">{player.ppg}</p>
            </div>
            <div>
              <p className="text-xs text-brand-text-dim mb-1">RPG</p>
              <p className="text-2xl font-bold text-white">{player.rpg}</p>
            </div>
            <div>
              <p className="text-xs text-brand-text-dim mb-1">APG</p>
              <p className="text-2xl font-bold text-white">{player.apg}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Deep Dive Analytics Section */}
      <div className="relative">
        <div className="absolute inset-0 opacity-10">
          {/* Circuit board pattern background - simplified */}
          <div className="w-full h-full bg-gradient-to-br from-brand-blue/20 via-purple-500/20 to-brand-blue/20" />
        </div>
        <h3 className="text-xl font-bold text-white text-center relative z-10 mb-6 uppercase">
          Deep Dive Analytics
        </h3>
      </div>

      {/* Clutch Time Performance */}
      <div className="bg-brand-card border border-brand-card-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-bold text-white uppercase">
            Clutch Time Performance (Last 5 Min, Close Games)
          </h4>
          <svg className="w-5 h-5 text-brand-text-dim" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
        <ClutchTimeChart stats={player.clutchTimeStats} />
      </div>

      {/* Shot Chart */}
      <div className="bg-brand-card border border-brand-card-border rounded-xl p-4">
        <h4 className="text-sm font-bold text-white uppercase mb-4">Shot Chart - Last 10 Games</h4>
        <ShotChart
          fgPercentage={player.shotChart.fgPercentage}
          threePointPercentage={player.shotChart.threePointPercentage}
        />
      </div>

      {/* Versus League Averages */}
      <div className="bg-brand-card border border-brand-card-border rounded-xl p-4">
        <h4 className="text-sm font-bold text-white uppercase mb-4">Versus League Averages</h4>
        <LeagueComparisonRadar comparison={player.leagueComparison} />
      </div>
    </div>
  );
}

