import type { PlayerDetail } from '@/types';

interface LeagueComparisonRadarProps {
  comparison: PlayerDetail['leagueComparison'];
}

export function LeagueComparisonRadar({ comparison }: LeagueComparisonRadarProps) {
  const size = 200;
  const center = size / 2;
  const radius = size * 0.4;

  const axes = [
    { label: 'Scoring', angle: -Math.PI / 2 }, // Top
    { label: 'Playmaking', angle: Math.PI / 10 }, // Top-right
    { label: 'Rebounding', angle: (3 * Math.PI) / 5 }, // Bottom-right
    { label: 'Defense', angle: (7 * Math.PI) / 5 }, // Bottom-left
    { label: 'Efficiency', angle: -Math.PI / 10 }, // Top-left
  ];

  const getPoint = (value: number, angle: number) => {
    const r = (value / 100) * radius;
    const x = center + r * Math.cos(angle);
    const y = center + r * Math.sin(angle);
    return { x, y };
  };

  // Player polygon
  const playerValues = [
    comparison.scoring,
    comparison.playmaking,
    comparison.rebounding,
    comparison.defense,
    comparison.efficiency,
  ];
  const playerPoints = axes.map((axis, index) => {
    const value = playerValues[index] ?? 0;
    return getPoint(value, axis.angle);
  });
  const playerPath = `M ${playerPoints.map((p) => `${p.x},${p.y}`).join(' L ')} Z`;

  // League mean polygon
  const leagueValues = [
    comparison.leagueMean.scoring,
    comparison.leagueMean.playmaking,
    comparison.leagueMean.rebounding,
    comparison.leagueMean.defense,
    comparison.leagueMean.efficiency,
  ];
  const leaguePoints = axes.map((axis, index) => {
    const value = leagueValues[index] ?? 0;
    return getPoint(value, axis.angle);
  });
  const leaguePath = `M ${leaguePoints.map((p) => `${p.x},${p.y}`).join(' L ')} Z`;

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="mb-4">
        {/* Grid circles */}
        {[1, 2, 3, 4].map((i) => (
          <circle
            key={i}
            cx={center}
            cy={center}
            r={(radius * i) / 4}
            fill="none"
            stroke="rgba(110, 226, 245, 0.1)"
            strokeWidth="1"
          />
        ))}

        {/* Axis lines */}
        {axes.map((axis) => {
          const endX = center + radius * Math.cos(axis.angle);
          const endY = center + radius * Math.sin(axis.angle);
          return (
            <line
              key={axis.label}
              x1={center}
              y1={center}
              x2={endX}
              y2={endY}
              stroke="rgba(110, 226, 245, 0.1)"
              strokeWidth="1"
            />
          );
        })}

        {/* League mean (dashed) */}
        <path
          d={leaguePath}
          fill="rgba(110, 226, 245, 0.2)"
          stroke="rgba(110, 226, 245, 0.5)"
          strokeWidth="2"
          strokeDasharray="4,4"
        />

        {/* Player (solid) */}
        <path
          d={playerPath}
          fill="rgba(110, 226, 245, 0.4)"
          stroke="#6EE2F5"
          strokeWidth="2"
        />

        {/* Labels */}
        {axes.map((axis) => {
          const labelRadius = radius + 15;
          const x = center + labelRadius * Math.cos(axis.angle);
          const y = center + labelRadius * Math.sin(axis.angle);
          return (
            <text
              key={axis.label}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="middle"
              className="text-xs fill-brand-text-light"
              fontSize="10"
            >
              {axis.label}
            </text>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-4 h-0.5 bg-brand-blue" />
          <span className="text-brand-text-dim">— League Mean</span>
        </div>
      </div>
    </div>
  );
}

