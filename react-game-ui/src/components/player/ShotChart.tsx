interface ShotChartProps {
  fgPercentage: number;
  threePointPercentage: number;
}

export function ShotChart({ fgPercentage, threePointPercentage }: ShotChartProps) {
  return (
    <div className="space-y-4">
      {/* Court visualization - simplified heat map */}
      <div className="relative w-full aspect-square bg-brand-dark rounded-lg border border-brand-card-border overflow-hidden">
        {/* Basketball court outline */}
        <svg viewBox="0 0 200 200" className="w-full h-full">
          {/* Court background */}
          <rect x="0" y="0" width="200" height="200" fill="#0D121D" />

          {/* Three-point arc */}
          <path
            d="M 100 180 A 80 80 0 0 1 20 180 L 20 200 L 180 200 L 180 180 A 80 80 0 0 1 100 180"
            fill="none"
            stroke="rgba(110, 226, 245, 0.3)"
            strokeWidth="1"
          />

          {/* Paint */}
          <rect x="70" y="150" width="60" height="50" fill="none" stroke="rgba(110, 226, 245, 0.3)" strokeWidth="1" />
          
          {/* Basket */}
          <circle cx="100" cy="165" r="8" fill="none" stroke="rgba(110, 226, 245, 0.5)" strokeWidth="1.5" />
          <line x1="100" y1="165" x2="100" y2="175" stroke="rgba(110, 226, 245, 0.5)" strokeWidth="1.5" />

          {/* Heat map areas - simplified */}
          {/* High efficiency area near basket (red) */}
          <circle cx="100" cy="170" r="25" fill="rgba(239, 68, 68, 0.4)" />
          
          {/* Left wing three-point (red) */}
          <circle cx="30" cy="140" r="15" fill="rgba(239, 68, 68, 0.3)" />
          
          {/* Right wing three-point (blue) */}
          <circle cx="170" cy="140" r="15" fill="rgba(59, 130, 246, 0.3)" />
          
          {/* Top of the key (blue) */}
          <circle cx="100" cy="120" r="20" fill="rgba(59, 130, 246, 0.2)" />
        </svg>
      </div>

      {/* Shooting percentages */}
      <div className="grid grid-cols-2 gap-4">
        <div className="text-center">
          <p className="text-xs text-brand-text-dim mb-1">FG%</p>
          <p className="text-2xl font-bold text-white">{fgPercentage}%</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-brand-text-dim mb-1">3P%</p>
          <p className="text-2xl font-bold text-white">{threePointPercentage}%</p>
        </div>
      </div>
    </div>
  );
}

