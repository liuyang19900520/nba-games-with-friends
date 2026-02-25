"use client";

interface ScoreTrendChartProps {
  scoreTrend: Array<{
    time: string;
    awayScore: number;
    homeScore: number;
    diff: number;
  }>;
  awayTeamName: string;
  homeTeamName: string;
}

export function ScoreTrendChart({
  scoreTrend,
  awayTeamName,
  homeTeamName,
}: ScoreTrendChartProps) {
  if (scoreTrend.length === 0) {
    return (
      <div className="bg-brand-card border border-brand-card-border rounded-lg p-4">
        <p className="text-sm text-brand-text-dim">No score trend data available</p>
      </div>
    );
  }

  // Find min and max for scaling
  const maxDiff = Math.max(
    ...scoreTrend.map((point) => Math.abs(point.diff))
  );
  const chartHeight = 200;
  const chartWidth = Math.max(400, scoreTrend.length * 30);

  // Calculate points for the line
  const points = scoreTrend.map((point, index) => {
    const x = (index / (scoreTrend.length - 1)) * chartWidth;
    const y = chartHeight / 2 - (point.diff / maxDiff) * (chartHeight / 2);
    return { x, y, point };
  });

  // Create SVG path
  const pathData = points
    .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
    .join(" ");

  return (
    <div className="bg-brand-card border border-brand-card-border rounded-lg p-4">
      <h3 className="text-sm font-semibold text-white mb-4">Score Trend</h3>
      <div className="overflow-x-auto">
        <svg
          width={chartWidth}
          height={chartHeight + 40}
          className="min-w-full"
          viewBox={`0 0 ${chartWidth} ${chartHeight + 40}`}
        >
          {/* Grid line at 0 (tie) */}
          <line
            x1={0}
            y1={chartHeight / 2 + 20}
            x2={chartWidth}
            y2={chartHeight / 2 + 20}
            stroke="currentColor"
            strokeWidth="1"
            strokeDasharray="4 4"
            className="text-brand-card-border"
          />

          {/* Score difference line */}
          <path
            d={pathData}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-brand-blue"
            transform={`translate(0, 20)`}
          />

          {/* Points */}
          {points.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y + 20}
              r="3"
              fill="currentColor"
              className="text-brand-blue"
            />
          ))}

          {/* Labels */}
          <text
            x={10}
            y={15}
            className="text-xs fill-green-500"
            fontWeight="500"
          >
            {awayTeamName} Lead
          </text>
          <text
            x={10}
            y={chartHeight + 35}
            className="text-xs fill-blue-500"
            fontWeight="500"
          >
            {homeTeamName} Lead
          </text>
        </svg>
      </div>
    </div>
  );
}
