export interface Player {
  id: string;
  name: string;
  team: string;
  position: string;
  avatar: string;
  ppg: number;
  rpg: number;
  teamLogo?: string;
}

export interface LineupSlot {
  position: 'PG' | 'SG' | 'SF' | 'PF' | 'C';
  playerId?: string;
}

