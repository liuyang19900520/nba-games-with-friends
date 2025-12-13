import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Header } from '@/components/layout/Header';
import type { LeaderboardEntry, LeaderboardFilter } from '@/types';
import { LeaderboardSidebar } from './LeaderboardSidebar';
import { LeaderboardList } from './LeaderboardList';

// Mock data - replace with actual API call later
const mockTeams: LeaderboardEntry[] = [
  { id: '1', rank: 1, name: 'Lakers', value: 45, wins: 45, losses: 15, conference: 'West', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/lal.png' },
  { id: '2', rank: 2, name: 'Celtics', value: 44, wins: 44, losses: 16, conference: 'East', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/bos.png' },
  { id: '3', rank: 3, name: 'Bucks', value: 43, wins: 43, losses: 17, conference: 'East', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/mil.png' },
  { id: '4', rank: 4, name: 'Warriors', value: 42, wins: 42, losses: 18, conference: 'West', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/gs.png' },
  { id: '5', rank: 5, name: 'Nuggets', value: 41, wins: 41, losses: 19, conference: 'West', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/den.png' },
  { id: '6', rank: 6, name: 'Heat', value: 40, wins: 40, losses: 20, conference: 'East', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/mia.png' },
];

const mockPlayers: LeaderboardEntry[] = [
  { id: '1', rank: 1, name: 'LeBron James', value: 28.5, team: 'Lakers', avatar: 'https://a.espncdn.com/combiner/i?img=/i/headshots/nba/players/full/1966.png' },
  { id: '2', rank: 2, name: 'Kevin Durant', value: 27.8, team: 'Suns', avatar: 'https://a.espncdn.com/combiner/i?img=/i/headshots/nba/players/full/3202.png' },
  { id: '3', rank: 3, name: 'Stephen Curry', value: 26.4, team: 'Warriors', avatar: 'https://a.espncdn.com/combiner/i?img=/i/headshots/nba/players/full/3975.png' },
  { id: '4', rank: 4, name: 'Giannis Antetokounmpo', value: 26.2, team: 'Bucks', avatar: 'https://a.espncdn.com/combiner/i?img=/i/headshots/nba/players/full/3136776.png' },
  { id: '5', rank: 5, name: 'Jayson Tatum', value: 25.9, team: 'Celtics', avatar: 'https://a.espncdn.com/combiner/i?img=/i/headshots/nba/players/full/4066261.png' },
];

export function LeaderboardPage() {
  const [activeTab, setActiveTab] = useState<'teams' | 'players'>('teams');
  const [selectedFilter, setSelectedFilter] = useState<LeaderboardFilter>(
    activeTab === 'teams' ? 'WINS' : 'PTS'
  );

  // Update filter based on active tab
  const handleTabChange = (value: string) => {
    const newTab = value as 'teams' | 'players';
    setActiveTab(newTab);
    // Reset filter based on tab
    setSelectedFilter(newTab === 'teams' ? 'WINS' : 'PTS');
  };

  const teamFilters: LeaderboardFilter[] = ['WINS', 'LOSSES', 'East', 'West'];
  const playerFilters: LeaderboardFilter[] = ['PTS', 'REB', 'AST'];

  const currentFilters = activeTab === 'teams' ? teamFilters : playerFilters;
  const currentData = activeTab === 'teams' ? mockTeams : mockPlayers;

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

        {/* Split View: Sidebar + Content */}
        <div className="flex-1 flex overflow-hidden mt-4">
          {/* Left Sidebar (25% width) */}
          <div className="w-1/4 border-r border-brand-card-border bg-brand-dark/50">
            <LeaderboardSidebar
              filters={currentFilters}
              selectedFilter={selectedFilter}
              onFilterSelect={setSelectedFilter}
            />
          </div>

          {/* Right Content Area (75% width) */}
          <div className="flex-1 overflow-y-auto">
            <LeaderboardList
              entries={currentData}
              filter={selectedFilter}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

