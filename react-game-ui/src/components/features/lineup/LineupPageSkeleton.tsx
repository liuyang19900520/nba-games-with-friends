/**
 * LineupPageSkeleton - 加载骨架屏
 *
 * 使用 Tailwind 的 animate-pulse 模拟球员卡片和球场占位图
 */
export function LineupPageSkeleton() {
  return (
    <>
      {/* Basketball Court Skeleton */}
      <section className="px-4 pt-4">
        <div className="bg-brand-dark/60 backdrop-blur-sm rounded-xl p-3">
          <div className="basketball-court-container relative min-h-[300px] animate-pulse">
            <div className="absolute inset-0 bg-brand-card/20 rounded-lg" />
            {/* Position slots skeleton */}
            <div className="absolute bottom-[18%] right-[32.5%] w-12 h-12 bg-brand-card/40 rounded-full" />
            <div className="absolute bottom-[18%] left-[32.5%] w-12 h-12 bg-brand-card/40 rounded-full" />
            <div className="absolute bottom-[45%] left-[15%] w-12 h-12 bg-brand-card/40 rounded-full" />
            <div className="absolute bottom-[47%] left-1/2 -translate-x-1/2 w-12 h-12 bg-brand-card/40 rounded-full" />
            <div className="absolute bottom-[45%] right-[15%] w-12 h-12 bg-brand-card/40 rounded-full" />
          </div>
        </div>
      </section>

      {/* Player Selection Prompt Skeleton */}
      <section className="mt-4 px-4">
        <div className="h-8 bg-brand-card/20 rounded-lg w-3/4 mx-auto animate-pulse mb-4" />

        {/* Player Cards Grid Skeleton */}
        <div className="grid grid-cols-2 gap-3 mt-4">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="bg-brand-card p-3 rounded-xl border border-brand-card-border animate-pulse"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-14 h-14 bg-brand-card-border rounded-full" />
                <div className="text-right ml-2 flex-1 space-y-2">
                  <div className="h-4 bg-brand-card-border rounded w-3/4 ml-auto" />
                  <div className="h-3 bg-brand-card-border rounded w-1/2 ml-auto" />
                  <div className="h-3 bg-brand-card-border rounded w-1/3 ml-auto" />
                </div>
              </div>
              <div className="flex items-end justify-between">
                <div className="w-8 h-8 bg-brand-card-border rounded" />
                <div className="text-center">
                  <div className="h-3 bg-brand-card-border rounded w-8 mb-1" />
                  <div className="h-4 bg-brand-card-border rounded w-12" />
                </div>
                <div className="text-center">
                  <div className="h-3 bg-brand-card-border rounded w-8 mb-1" />
                  <div className="h-4 bg-brand-card-border rounded w-12" />
                </div>
                <div className="w-7 h-7 bg-brand-card-border rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
