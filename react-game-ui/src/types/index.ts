/**
 * UI-specific types (view models)
 * These types are optimized for component props and UI rendering
 */

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

export interface LeaderboardEntry {
  id?: string;
  rank: number;
  name: string; // Required - team or player name
  teamName?: string; // Legacy field, use name instead
  wins?: number;
  losses?: number;
  winPct?: number;
  logo?: string;
  logoUrl?: string;
  streak?: string;
  conference?: "East" | "West";
  value?: number;
  avatar?: string;
  team?: string;
}

export interface PlayerCardProps {
  player: {
    id: string;
    name: string;
    position: string;
    team: string;
    avatar: string;
    ppg: number;
    rpg: number;
    apg: number;
    fantasyScore: number;
  };
  isActive?: boolean;
  onSelect?: () => void;
  priority?: boolean;
}

export interface TeamHeaderProps {
  name: string;
  logo?: string;
  record: string;
  rank: number;
}

export interface TeamDetail {
  id: string | number;
  name: string;
  logo?: string;
  rank: number;
  record: string;
  conference: "East" | "West";
  stats: {
    ppg: number;
    rpg: number;
    apg: number;
    stl: number;
    blk: number;
    tov: number;
  };
  players: Array<{
    id: string;
    name: string;
    position: "PG" | "SG" | "SF" | "PF" | "C";
    avatar: string;
    pts: number;
    reb: number;
    ast: number;
    stl: number;
    blk: number;
    tov: number;
    fantasyScore: number;
    fantasyScores: number[];
  }>;
}

export interface PlayerDetail {
  id: string;
  name: string;
  position: string;
  jerseyNumber: string;
  team: string;
  teamLogo?: string;
  avatar: string;
  ppg: number;
  rpg: number;
  apg: number;
  stl: number;
  blk: number;
  tov: number;
  fantasyScore: number;
  clutchTimeStats: {
    points: { player: number; league: number; percentile: number };
    assists: { player: number; league: number; percentile: number };
    rebounds: { player: number; league: number; percentile: number };
  };
  shotChart: {
    fgPercentage: number;
    threePointPercentage: number;
  };
  leagueComparison: {
    scoring: number;
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
  recentGames: RecentGame[];
  isFollowed: boolean;
}

export interface RecentGame {
  date: string; // Format: YYYY/MM/DD
  opponent: string; // Format: "@TEAM" or "vs TEAM"
  min: number; // Minutes played
  pts: number; // Points
  reb: number; // Rebounds
  ast: number; // Assists
  stl: number; // Steals
  blk: number; // Blocks
  tov: number; // Turnovers
  fantasy: number; // Fantasy score
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

export type LeaderboardFilter =
  | "East"
  | "West"
  | "PTS"
  | "REB"
  | "AST"
  | "WINS"
  | "LOSSES";

/**
 * Game result for home page display
 */
export interface GameResult {
  id: string;
  gameType: string; // e.g., "NBA Regular Season"
  homeTeam: {
    id: string;
    name: string;
    code: string;
    logoUrl: string | null;
    score: number;
  };
  awayTeam: {
    id: string;
    name: string;
    code: string;
    logoUrl: string | null;
    score: number;
  };
  ratingCount?: number; // Number of ratings (e.g., 118000)
  gameDate?: string; // ISO date string
}
