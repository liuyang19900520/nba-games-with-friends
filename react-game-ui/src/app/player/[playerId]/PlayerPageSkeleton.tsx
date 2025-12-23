export function PlayerPageSkeleton() {
  return (
    <div className="flex flex-col h-full max-w-md mx-auto">
      <div className="pt-[60px] pb-4 px-4">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-brand-card/40 rounded w-2/3" />
          <div className="h-32 bg-brand-card/30 rounded-xl" />
          <div className="h-6 bg-brand-card/40 rounded w-1/2" />
          <div className="h-40 bg-brand-card/30 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

