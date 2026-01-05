'use client';

import { useState } from 'react';
import { Search } from 'lucide-react';
import Image from 'next/image';
import type { Player } from '@/types';

const FILTER_TABS = ['Position', 'Team', 'PTS', 'REB', 'AST', 'Fantasy Points'];
const POSITION_FILTERS = ['C', 'F', 'G'] as const;

interface PlayerSearchSectionProps {
  players: Player[];
  onAddPlayer: (player: Player) => void;
  selectedPlayerIds: string[];
  disabled?: boolean;
  selectedPositionFilter?: 'C' | 'F' | 'G' | null;
  onPositionFilterChange?: (position: 'C' | 'F' | 'G' | null) => void;
}

/**
 * Check if a player can play a specific position
 * Handles positions like "C", "F", "G", "G-F", "F-C", etc.
 */
function playerCanPlayPosition(player: Player, position: 'C' | 'F' | 'G'): boolean {
  if (!player.position) return false;
  
  const playerPositions = player.position.toUpperCase();
  
  // Check if player position contains the requested position
  // Examples: "C" matches "C", "F-C" matches "F" and "C", "G-F" matches "G" and "F"
  if (position === 'C') {
    return playerPositions.includes('C');
  } else if (position === 'F') {
    return playerPositions.includes('F');
  } else if (position === 'G') {
    return playerPositions.includes('G');
  }
  
  return false;
}

export function PlayerSearchSection({
  players,
  onAddPlayer,
  selectedPlayerIds,
  disabled = false,
  selectedPositionFilter = null,
  onPositionFilterChange,
}: PlayerSearchSectionProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('Position');

  // Filter players based on search query and position filter
  const filteredPlayers = players.filter((player) => {
    // Search filter
    const matchesSearch = player.name.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Position filter
    const matchesPosition = selectedPositionFilter 
      ? playerCanPlayPosition(player, selectedPositionFilter)
      : true;
    
    return matchesSearch && matchesPosition;
  });
  
  // Update active filter when position filter changes
  const handlePositionFilterClick = (position: 'C' | 'F' | 'G') => {
    if (onPositionFilterChange) {
      // Toggle: if already selected, clear it; otherwise set it
      const newFilter = selectedPositionFilter === position ? null : position;
      onPositionFilterChange(newFilter);
      setActiveFilter('Position');
    }
  };

  return (
    <div className="mt-4 px-4">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-text-dim" />
        <input
          type="text"
          placeholder="Search players"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          disabled={disabled}
          className="w-full pl-12 pr-4 py-3 bg-transparent border border-brand-blue/50 rounded-full text-white placeholder-brand-text-dim focus:outline-none focus:border-brand-blue disabled:opacity-50"
        />
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mt-4 overflow-x-auto pb-2 scrollbar-hide">
        {/* Position filters (C, F, G) */}
        {POSITION_FILTERS.map((position) => (
          <button
            key={position}
            onClick={() => handlePositionFilterClick(position)}
            disabled={disabled}
            className={`px-4 py-2 rounded-full text-sm whitespace-nowrap transition-colors
              ${selectedPositionFilter === position
                ? 'bg-brand-blue/20 text-brand-blue border border-brand-blue'
                : 'bg-transparent text-brand-text-dim border border-brand-card-border hover:border-brand-blue/50'
              }
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
          >
            {position}
          </button>
        ))}
        
        {/* Other filter tabs */}
        {FILTER_TABS.filter(tab => tab !== 'Position').map((tab) => (
          <button
            key={tab}
            onClick={() => {
              setActiveFilter(tab);
              if (onPositionFilterChange) {
                onPositionFilterChange(null); // Clear position filter when selecting other filters
              }
            }}
            disabled={disabled}
            className={`px-4 py-2 rounded-full text-sm whitespace-nowrap transition-colors
              ${activeFilter === tab
                ? 'bg-brand-blue/20 text-brand-blue border border-brand-blue'
                : 'bg-transparent text-brand-text-dim border border-brand-card-border hover:border-brand-blue/50'
              }
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Player List */}
      <div className="mt-4 space-y-3 pb-24">
        {filteredPlayers.map((player) => {
          const isSelected = selectedPlayerIds.includes(player.id);
          
          return (
            <div
              key={player.id}
              className={`flex items-center gap-3 p-3 rounded-xl bg-brand-card border transition-all
                ${isSelected 
                  ? 'border-green-500/50 bg-green-500/10' 
                  : 'border-brand-card-border'
                }
              `}
            >
              {/* Player Avatar with Team Logo */}
              <div className="relative flex-shrink-0">
                <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-brand-card-border">
                  <Image
                    src={player.avatar}
                    alt={player.name}
                    width={64}
                    height={64}
                    className="w-full h-full object-cover"
                  />
                </div>
                {/* Team Logo Badge */}
                {player.teamLogo && (
                  <div className="absolute -bottom-1 -left-1 w-6 h-6 rounded-full bg-brand-dark border border-brand-card-border overflow-hidden">
                    <Image
                      src={player.teamLogo}
                      alt={player.team}
                      width={24}
                      height={24}
                      className="w-full h-full object-contain"
                    />
                  </div>
                )}
              </div>

              {/* Player Info */}
              <div className="flex-1 min-w-0">
                {/* Name */}
                <div className="flex items-center gap-1">
                  <span className="font-bold text-white text-sm truncate">
                    {player.name}
                  </span>
                </div>

                {/* Stats */}
                <div className="flex gap-4 mt-1">
                  <div className="text-center">
                    <span className="text-xs text-brand-text-dim block">PTS</span>
                    <span className="text-sm font-semibold text-brand-blue">{player.ppg.toFixed(1)}</span>
                  </div>
                  <div className="text-center">
                    <span className="text-xs text-brand-text-dim block">REB</span>
                    <span className="text-sm font-semibold text-white">{player.rpg.toFixed(1)}</span>
                  </div>
                  <div className="text-center">
                    <span className="text-xs text-brand-text-dim block">AST</span>
                    <span className="text-sm font-semibold text-brand-blue">{player.apg?.toFixed(1) || '0.0'}</span>
                  </div>
                  <div className="text-center">
                    <span className="text-xs text-brand-text-dim block">FNP</span>
                    <span className="text-sm font-semibold text-white">{player.fantasyScore?.toFixed(1) || '0.0'}</span>
                  </div>
                </div>
              </div>

              {/* Add Button */}
              <button
                onClick={() => onAddPlayer(player)}
                disabled={disabled || isSelected}
                className={`px-6 py-2 rounded-full text-sm font-semibold transition-all flex-shrink-0
                  ${isSelected
                    ? 'bg-green-500/20 text-green-400 border border-green-500/50 cursor-default'
                    : 'bg-transparent text-brand-blue border border-brand-blue hover:bg-brand-blue/20 active:scale-95'
                  }
                  disabled:opacity-50 disabled:cursor-not-allowed
                `}
              >
                {isSelected ? 'Added' : 'Add'}
              </button>
            </div>
          );
        })}

        {filteredPlayers.length === 0 && (
          <div className="text-center py-8 text-brand-text-dim">
            No players found
          </div>
        )}
      </div>
    </div>
  );
}
