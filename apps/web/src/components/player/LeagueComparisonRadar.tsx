'use client';

import type { LeagueAverages } from '@/lib/db/players';

interface PlayerStats {
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  fantasy_avg: number;
}

interface LeagueComparisonRadarProps {
  playerStats: PlayerStats;
  leagueAverages: LeagueAverages;
}

// Stat configuration with labels and max values for scaling
const STAT_CONFIG = [
  { key: 'pts', label: 'PTS', maxValue: 35 },
  { key: 'reb', label: 'REB', maxValue: 15 },
  { key: 'ast', label: 'AST', maxValue: 12 },
  { key: 'stl', label: 'STL', maxValue: 3 },
  { key: 'blk', label: 'BLK', maxValue: 3 },
  { key: 'fantasy_avg', label: 'FPTS', maxValue: 50 },
] as const;

/**
 * Hexagon radar chart comparing player stats to league averages
 */
export function LeagueComparisonRadar({ playerStats, leagueAverages }: LeagueComparisonRadarProps) {
  const size = 240;
  const center = size / 2;
  const radius = size * 0.35;
  const numAxes = 6;

  // Calculate angle for each axis (starting from top, going clockwise)
  const getAngle = (index: number) => {
    return (index * 2 * Math.PI) / numAxes - Math.PI / 2;
  };

  // Get point coordinates based on value and angle
  const getPoint = (value: number, maxValue: number, angle: number) => {
    const normalizedValue = Math.min(value / maxValue, 1); // Cap at 100%
    const r = normalizedValue * radius;
    const x = center + r * Math.cos(angle);
    const y = center + r * Math.sin(angle);
    return { x, y };
  };

  // Generate polygon path from stats
  const getPolygonPath = (stats: PlayerStats | LeagueAverages) => {
    const points = STAT_CONFIG.map((config, index) => {
      const value = stats[config.key as keyof typeof stats] || 0;
      const angle = getAngle(index);
      return getPoint(value, config.maxValue, angle);
    });
    return `M ${points.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' L ')} Z`;
  };

  // Generate hexagon grid path
  const getHexagonPath = (scale: number) => {
    const points = Array.from({ length: numAxes }, (_, i) => {
      const angle = getAngle(i);
      const x = center + radius * scale * Math.cos(angle);
      const y = center + radius * scale * Math.sin(angle);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    });
    return `M ${points.join(' L ')} Z`;
  };

  const playerPath = getPolygonPath(playerStats);
  const leaguePath = getPolygonPath(leagueAverages);

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="mb-4">
        {/* Hexagon grid */}
        {[0.25, 0.5, 0.75, 1].map((scale) => (
          <path
            key={scale}
            d={getHexagonPath(scale)}
            fill="none"
            stroke="rgba(110, 226, 245, 0.15)"
            strokeWidth="1"
          />
        ))}

        {/* Axis lines */}
        {STAT_CONFIG.map((_, index) => {
          const angle = getAngle(index);
          const endX = center + radius * Math.cos(angle);
          const endY = center + radius * Math.sin(angle);
          return (
            <line
              key={index}
              x1={center}
              y1={center}
              x2={endX}
              y2={endY}
              stroke="rgba(110, 226, 245, 0.15)"
              strokeWidth="1"
            />
          );
        })}

        {/* League average polygon (dashed, background) */}
        <path
          d={leaguePath}
          fill="rgba(245, 166, 35, 0.15)"
          stroke="rgba(245, 166, 35, 0.6)"
          strokeWidth="2"
          strokeDasharray="4,4"
        />

        {/* Player polygon (solid, foreground) */}
        <path
          d={playerPath}
          fill="rgba(110, 226, 245, 0.3)"
          stroke="#6EE2F5"
          strokeWidth="2"
        />

        {/* Axis labels and values */}
        {STAT_CONFIG.map((config, index) => {
          const angle = getAngle(index);
          const labelRadius = radius + 25;
          const x = center + labelRadius * Math.cos(angle);
          const y = center + labelRadius * Math.sin(angle);
          const playerValue = playerStats[config.key as keyof PlayerStats] || 0;
          
          return (
            <g key={config.key}>
              {/* Stat label */}
              <text
                x={x}
                y={y - 8}
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-brand-text-dim"
                fontSize="10"
                fontWeight="500"
              >
                {config.label}
              </text>
              {/* Player value */}
              <text
                x={x}
                y={y + 6}
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-brand-blue"
                fontSize="11"
                fontWeight="600"
              >
                {playerValue.toFixed(1)}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="flex items-center gap-6 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-4 h-1 bg-brand-blue rounded" />
          <span className="text-brand-text-dim">Player</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-1 bg-brand-orange rounded opacity-60" style={{ backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 2px, #F5A623 2px, #F5A623 4px)' }} />
          <span className="text-brand-text-dim">League Avg</span>
        </div>
      </div>

      {/* Stats comparison table */}
      <div className="mt-4 w-full grid grid-cols-3 gap-2 text-xs">
        {STAT_CONFIG.map((config) => {
          const playerValue = playerStats[config.key as keyof PlayerStats] || 0;
          const leagueValue = leagueAverages[config.key as keyof LeagueAverages] || 0;
          const diff = playerValue - leagueValue;
          const isPositive = diff > 0;
          
          return (
            <div key={config.key} className="flex flex-col items-center p-2 bg-brand-dark/50 rounded">
              <span className="text-brand-text-dim mb-1">{config.label}</span>
              <span className="text-white font-semibold">{playerValue.toFixed(1)}</span>
              <span className={`text-[10px] ${isPositive ? 'text-green-400' : diff < 0 ? 'text-red-400' : 'text-brand-text-dim'}`}>
                {isPositive ? '+' : ''}{diff.toFixed(1)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
