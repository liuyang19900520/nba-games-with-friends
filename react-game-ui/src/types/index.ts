export interface Player {
  id: string;
  name: string;
  team: string;
  position: "PG" | "SG" | "SF" | "PF" | "C";
  avatar: string;
  ppg: number;
  rpg: number;
  teamLogo?: string;
}

export interface LineupSlot {
  position: "PG" | "SG" | "SF" | "PF" | "C";
  playerId?: string;
}

export interface Team {
  id: string;
  name: string;
  conference: "East" | "West";
  wins: number;
  losses: number;
  winPercentage: number;
  logo?: string;
}

export interface TeamStats {
  ppg: number; // Points per game
  rpg: number; // Rebounds per game
  apg: number; // Assists per game
  stl: number; // Steals per game
  blk: number; // Blocks per game
  tov: number; // Turnovers per game
}

export interface PlayerStats {
  id: string;
  name: string;
  position: "PG" | "SG" | "SF" | "PF" | "C";
  avatar: string;
  pts: number; // Points
  reb: number; // Rebounds
  ast: number; // Assists
  stl?: number; // Steals
  blk?: number; // Blocks
  tov?: number; // Turnovers
  "3pt%"?: number; // 3-point percentage
  defRating?: number; // Defensive rating
  recentGames?: number[]; // Recent game performance (e.g., [20, 28, 17, 19, 23, 35])
  fantasyScore?: number; // Latest fantasy score
  fantasyScores?: number[]; // Last 5 games' fantasy scores for chart
  radarStats?: {
    reb: number;
    ast: number;
    blk: number;
    stl: number;
  };
}

export interface PlayerDetail {
  id: string;
  name: string;
  position: string; // e.g., "PG/SG"
  jerseyNumber: string;
  team: string;
  teamLogo?: string;
  avatar: string;
  ppg: number;
  rpg: number;
  apg: number;
  clutchTimeStats: {
    points: { player: number; league: number; percentile: number };
    assists: { player: number; league: number; percentile: number };
    rebounds: { player: number; league: number; percentile: number };
  };
  shotChart: {
    fgPercentage: number;
    threePointPercentage: number;
    // Heat map data would typically be more complex
  };
  leagueComparison: {
    scoring: number; // 0-100
    playmaking: number;
    rebounding: number;
    defense: number;
    efficiency: number;
    leagueMean: {
      scoring: number;
      playmaking: number;
      rebounding: number;
      defense: number;
      efficiency: number;
    };
  };
  isFollowed?: boolean;
}

export interface TeamDetail {
  id: string;
  name: string;
  logo?: string;
  rank: number;
  record: string; // e.g., "45-20"
  conference: "East" | "West";
  stats: TeamStats;
  players: PlayerStats[];
}

export interface LeaderboardEntry {
  id: string;
  rank: number;
  name: string;
  value: number;
  avatar?: string;
  logo?: string;
  logoUrl?: string; // Preferred over logo for team entries
  team?: string;
  conference?: "East" | "West";
  wins?: number;
  losses?: number;
  winPct?: number; // Win percentage (e.g., 0.750)
  streak?: string; // e.g., "W5", "L2"
}

export type LeaderboardFilter =
  | "East"
  | "West"
  | "PTS"
  | "REB"
  | "AST"
  | "WINS"
  | "LOSSES";
