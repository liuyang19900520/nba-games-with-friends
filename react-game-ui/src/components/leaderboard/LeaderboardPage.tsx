'use client';

import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Header } from '@/components/layout/Header';
import type { LeaderboardEntry, LeaderboardFilter } from '@/types';
import type { PlayerSeasonStats } from '@/types/nba';
import { LeaderboardSidebar } from './LeaderboardSidebar';
import { LeaderboardList } from './LeaderboardList';
import { PlayerLeaderboard } from './PlayerLeaderboard';
import { CONFERENCES } from '@/config/constants';

interface LeaderboardPageProps {
  initialStandings: LeaderboardEntry[];
  initialConference?: "East" | "West";
  initialPlayerStats?: PlayerSeasonStats[];
}

export function LeaderboardPage({
  initialStandings,
  initialConference = CONFERENCES.EAST,
  initialPlayerStats = [],
}: LeaderboardPageProps) {
  const [activeTab, setActiveTab] = useState<'teams' | 'players'>('teams');
  const [selectedFilter, setSelectedFilter] = useState<LeaderboardFilter>(
    activeTab === 'teams' ? initialConference : 'PTS'
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

  const [teamStandings] = useState<LeaderboardEntry[]>(initialStandings);
  const [playerStats] = useState<PlayerSeasonStats[]>(initialPlayerStats);

  const teamFilters: LeaderboardFilter[] = [CONFERENCES.EAST, CONFERENCES.WEST];

  return (
    <div className="flex flex-col h-full max-w-md mx-auto">
      <Header title="Leaderboard" />

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
                {teamStandings.length === 0 && (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-brand-text-dim">No standings data available</p>
                  </div>
                )}
                {teamStandings.length > 0 && (
                  <LeaderboardList
                    entries={teamStandings}
                    filter={selectedFilter}
                  />
                )}
              </div>
            </div>
          ) : (
            <PlayerLeaderboard stats={playerStats} />
          )}
        </div>
      </div>
    </div>
  );
}

