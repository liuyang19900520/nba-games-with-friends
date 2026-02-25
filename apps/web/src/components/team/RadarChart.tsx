interface RadarChartProps {
  stats: {
    reb: number;
    ast: number;
    blk: number;
    stl: number;
  };
  size: number;
}

export function RadarChart({ stats, size }: RadarChartProps) {
  const center = size / 2;
  const radius = size * 0.35;

  // Normalize stats (assuming max values)
  const maxValues = { reb: 15, ast: 10, blk: 3, stl: 3 };
  const normalized = {
    reb: (stats.reb / maxValues.reb) * radius,
    ast: (stats.ast / maxValues.ast) * radius,
    blk: (stats.blk / maxValues.blk) * radius,
    stl: (stats.stl / maxValues.stl) * radius,
  };

  // Calculate positions for 4 stats (top, right, bottom, left)
  const points = [
    { x: center, y: center - normalized.reb }, // REB (top)
    { x: center + normalized.ast, y: center }, // AST (right)
    { x: center, y: center + normalized.blk }, // BLK (bottom)
    { x: center - normalized.stl, y: center }, // STL (left)
  ];

  const pathData = `M ${points.map((p) => `${p.x},${p.y}`).join(' L ')} Z`;

  // Grid lines
  const gridLevels = 3;
  const gridLines = Array.from({ length: gridLevels }, (_, i) => {
    const r = (radius * (i + 1)) / gridLevels;
    return {
      cx: center,
      cy: center,
      r,
    };
  });

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Grid circles */}
      {gridLines.map((line, i) => (
        <circle
          key={i}
          cx={line.cx}
          cy={line.cy}
          r={line.r}
          fill="none"
          stroke="rgba(110, 226, 245, 0.1)"
          strokeWidth="1"
        />
      ))}

      {/* Grid lines */}
      <line
        x1={center}
        y1={0}
        x2={center}
        y2={size}
        stroke="rgba(110, 226, 245, 0.1)"
        strokeWidth="1"
      />
      <line
        x1={0}
        y1={center}
        x2={size}
        y2={center}
        stroke="rgba(110, 226, 245, 0.1)"
        strokeWidth="1"
      />

      {/* Stats area */}
      <path
        d={pathData}
        fill="rgba(168, 85, 247, 0.3)"
        stroke="#A855F7"
        strokeWidth="2"
      />

      {/* Labels */}
      <text
        x={center}
        y={10}
        textAnchor="middle"
        className="text-[8px] fill-brand-text-dim"
        fontSize="8"
      >
        REB
      </text>
      <text
        x={size - 5}
        y={center + 3}
        textAnchor="end"
        className="text-[8px] fill-brand-text-dim"
        fontSize="8"
      >
        AST
      </text>
      <text
        x={center}
        y={size - 5}
        textAnchor="middle"
        className="text-[8px] fill-brand-text-dim"
        fontSize="8"
      >
        BLK
      </text>
      <text
        x={5}
        y={center + 3}
        textAnchor="start"
        className="text-[8px] fill-brand-text-dim"
        fontSize="8"
      >
        STL
      </text>
    </svg>
  );
}

