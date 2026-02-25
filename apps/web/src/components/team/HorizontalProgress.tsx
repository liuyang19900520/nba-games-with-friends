interface HorizontalProgressProps {
  value: number;
  max: number;
  label: string;
  color: string;
  reverse?: boolean; // If true, higher value means less progress (for ratings)
}

export function HorizontalProgress({
  value,
  max,
  label,
  color,
  reverse = false,
}: HorizontalProgressProps) {
  const percentage = reverse ? ((max - value) / max) * 100 : (value / max) * 100;
  const clampedPercentage = Math.max(0, Math.min(100, percentage));

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-brand-text-dim">{label}</span>
        <span className="text-xs font-bold" style={{ color }}>
          {value.toFixed(1)}{label.includes('%') ? '%' : ''}
        </span>
      </div>
      <div className="w-full h-2 bg-brand-card-border rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${clampedPercentage}%`,
            backgroundColor: color,
          }}
        />
      </div>
    </div>
  );
}

