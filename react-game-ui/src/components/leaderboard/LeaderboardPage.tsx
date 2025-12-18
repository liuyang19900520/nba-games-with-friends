import { useState, useMemo } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Header } from '@/components/layout/Header';
import type { LeaderboardFilter } from '@/types';
import { LeaderboardSidebar } from './LeaderboardSidebar';
import { LeaderboardList } from './LeaderboardList';
import { PlayerLeaderboard } from './PlayerLeaderboard';
import { useStandings } from '@/hooks/useStandings';
import { DEFAULT_SEASON, CONFERENCES } from '@/config/constants';

export function LeaderboardPage() {
  const [activeTab, setActiveTab] = useState<'teams' | 'players'>('teams');
  const [selectedFilter, setSelectedFilter] = useState<LeaderboardFilter>(
    activeTab === 'teams' ? CONFERENCES.EAST : 'PTS'
  );

  // Update filter based on active tab
  const handleTabChange = (value: string) => {
    const newTab = value as 'teams' | 'players';
    setActiveTab(newTab);
    // Reset filter for teams tab
    if (newTab === 'teams') {
      setSelectedFilter(CONFERENCES.EAST);
    }
  };

  // Determine conference filter from selectedFilter for teams tab
  const conferenceFilter = useMemo(() => {
    if (activeTab === 'teams' && (selectedFilter === CONFERENCES.EAST || selectedFilter === CONFERENCES.WEST)) {
      return selectedFilter;
    }
    return undefined;
  }, [activeTab, selectedFilter]);

  // Fetch team standings from Supabase
  const {
    leaderboardEntries: teamStandings,
    loading: teamsLoading,
    error: teamsError,
    refetch: refetchTeams,
  } = useStandings({
    season: DEFAULT_SEASON,
    conference: conferenceFilter,
    enabled: activeTab === 'teams',
  });

  const teamFilters: LeaderboardFilter[] = [CONFERENCES.EAST, CONFERENCES.WEST];

  return (
    <div className="flex flex-col h-full max-w-md mx-auto">
      <Header title="Leaderboard" showSettings />
      
      <div className="flex-1 flex flex-col pt-[60px] pb-[90px] overflow-hidden">
        {/* Top Tabs */}
        <div className="px-4 pt-4">
          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <TabsList className="w-full grid grid-cols-2">
              <TabsTrigger value="teams">Teams</TabsTrigger>
              <TabsTrigger value="players">Players</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden mt-4">
          {activeTab === 'teams' ? (
            /* Teams Tab: Split View with Sidebar */
            <div className="flex-1 flex overflow-hidden h-full">
              {/* Left Sidebar (25% width) */}
              <div className="w-1/4 border-r border-brand-card-border bg-brand-dark/50">
                <LeaderboardSidebar
                  filters={teamFilters}
                  selectedFilter={selectedFilter}
                  onFilterSelect={setSelectedFilter}
                />
              </div>

              {/* Right Content Area (75% width) */}
              <div className="flex-1 overflow-y-auto">
                {teamsLoading && (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-brand-text-dim">Loading standings...</p>
                  </div>
                )}
                {teamsError && (
                  <div className="flex flex-col items-center justify-center h-full p-4">
                    <p className="text-red-500 mb-2">Error loading standings</p>
                    <p className="text-brand-text-dim text-sm mb-4">{teamsError.message}</p>
                    <button
                      onClick={() => refetchTeams()}
                      className="px-4 py-2 bg-brand-blue text-brand-dark rounded-lg hover:bg-brand-blue/80 transition-colors"
                    >
                      Retry
                    </button>
                  </div>
                )}
                {!teamsLoading && !teamsError && teamStandings.length === 0 && (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-brand-text-dim">No standings data available</p>
                  </div>
                )}
                {!teamsLoading && !teamsError && teamStandings.length > 0 && (
                  <LeaderboardList
                    entries={teamStandings}
                    filter={selectedFilter}
                  />
                )}
              </div>
            </div>
          ) : (
            /* Players Tab: Full-width PlayerLeaderboard with built-in sidebar */
            <PlayerLeaderboard season={DEFAULT_SEASON} />
          )}
        </div>
      </div>
    </div>
  );
}

