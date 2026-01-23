interface LineChartProps {
  data: number[];
  color: string;
  width: number;
  height: number;
}

export function LineChart({ data, color, width, height }: LineChartProps) {
  if (data.length === 0) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((value, index) => {
    const x = (index / (data.length - 1 || 1)) * (width - 10) + 5;
    const y = height - 5 - ((value - min) / range) * (height - 10);
    return `${x},${y}`;
  });

  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Data points */}
      {points.map((point, index) => {
        const [x, y] = point.split(',').map(Number);
        return (
          <circle
            key={index}
            cx={x}
            cy={y}
            r="2"
            fill={color}
            className="opacity-70"
          />
        );
      })}
    </svg>
  );
}

