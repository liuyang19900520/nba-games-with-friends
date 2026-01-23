"use client";

type TabType = "Summary" | "Rating" | "Stats" | "Live" | "Game";

interface MatchTabsProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

const tabs: TabType[] = ["Summary", "Rating", "Stats", "Live", "Game"];

export function MatchTabs({ activeTab, onTabChange }: MatchTabsProps) {
  return (
    <div className="sticky top-0 z-10 bg-brand-card border-b border-brand-card-border">
      <div className="flex overflow-x-auto scrollbar-hide">
        {tabs.map((tab) => {
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => onTabChange(tab)}
              className={`flex-shrink-0 px-4 py-3 text-sm font-medium transition-colors relative ${
                isActive
                  ? "text-white"
                  : "text-brand-text-dim hover:text-brand-text-light"
              }`}
            >
              {tab}
              {isActive && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-blue" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
