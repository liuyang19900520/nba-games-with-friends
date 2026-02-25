export function MatchPageSkeleton() {
  return (
    <div className="flex flex-col h-full bg-brand-dark">
      {/* Header Skeleton */}
      <div className="h-[200px] bg-brand-card border-b border-brand-card-border animate-pulse" />

      {/* Tabs Skeleton */}
      <div className="h-12 bg-brand-card border-b border-brand-card-border animate-pulse" />

      {/* Content Skeleton */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="h-32 bg-brand-card rounded-lg animate-pulse" />
        <div className="h-48 bg-brand-card rounded-lg animate-pulse" />
        <div className="h-64 bg-brand-card rounded-lg animate-pulse" />
      </div>
    </div>
  );
}
