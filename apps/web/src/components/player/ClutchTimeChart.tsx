import type { PlayerDetail } from '@/types';

interface ClutchTimeChartProps {
  stats: PlayerDetail['clutchTimeStats'];
}

export function ClutchTimeChart({ stats }: ClutchTimeChartProps) {
  const categories = [
    { key: 'points' as const, label: 'Points' },
    { key: 'assists' as const, label: 'Assists' },
    { key: 'rebounds' as const, label: 'Rebounds' },
  ];

  const maxValue = 50;

  return (
    <div className="space-y-4">
      {/* Y-axis labels and bars */}
      <div className="relative">
        {/* Y-axis */}
        <div className="absolute left-0 top-0 bottom-0 w-8 flex flex-col justify-between text-xs text-brand-text-dim">
          <span>{maxValue}</span>
          <span>{Math.floor(maxValue / 2)}</span>
          <span>0</span>
        </div>

        {/* Chart area */}
        <div className="ml-10 space-y-6">
          {/* League average line */}
          <div className="absolute left-10 right-0 top-1/2 border-t border-dashed border-brand-text-dim/30" />
          <div className="text-xs text-brand-text-dim absolute left-10 top-1/2 -translate-y-1/2 -ml-12">
            Leag. Avg.
          </div>

          {/* Categories */}
          {categories.map((category) => {
            const stat = stats[category.key];
            const playerHeight = (stat.player / maxValue) * 100;
            const percentileHeight = Math.min((stat.percentile / maxValue) * 100, 100);

            return (
              <div key={category.key} className="relative">
                <p className="text-xs text-brand-text-dim mb-2">{category.label}</p>
                <div className="flex items-end gap-2 h-32">
                  {/* Percentile bars (light blue) */}
                  <div className="flex-1 flex items-end gap-1">
                    <div
                      className="flex-1 bg-brand-blue/60 rounded-t"
                      style={{ height: `${percentileHeight}%` }}
                    >
                      <div className="text-[10px] text-white text-center mt-1">
                        {stat.percentile}%
                      </div>
                    </div>
                    <div
                      className="flex-1 bg-brand-blue/40 rounded-t"
                      style={{ height: `${Math.min(percentileHeight * 0.7, 100)}%` }}
                    />
                  </div>

                  {/* Player bar (purple) */}
                  <div className="flex-1 relative">
                    <div
                      className="w-full bg-purple-500 rounded-t"
                      style={{ height: `${playerHeight}%` }}
                    >
                      <div className="text-[10px] text-white text-center mt-1 font-bold">
                        {stat.player.toFixed(1)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

