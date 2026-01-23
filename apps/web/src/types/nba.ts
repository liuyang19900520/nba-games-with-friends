/**
 * TypeScript interfaces for NBA data matching our Supabase database schema.
 */

/**
 * Team information from the `teams` table
 * Schema: id (int4), name, nickname, code, city, logo_url, conference, division, primary_color, created_at
 */
export interface Team {
  id: string; // int4 in DB, converted to string by Supabase
  name: string;
  nickname: string;
  code: string;
  city: string;
  logo_url: string | null;
  conference: "East" | "West";
  division: string;
  primary_color?: string | null;
  created_at?: string | null; // timestamptz
}

/**
 * Team standing record from the `team_standings` table
 * Schema: id (int8), team_id (int4), season, wins, losses, win_pct, conf_rank,
 *         home_record, road_record, streak, updated_at
 * This represents a single row with joined team data
 */
export interface TeamStanding {
  // From team_standings table
  id: string; // int8 in DB, converted to string by Supabase
  team_id: string; // int4 in DB, converted to string by Supabase
  season: string;
  wins: number;
  losses: number;
  win_pct: number; // float8, e.g., 0.750
  conf_rank: number; // Conference rank (1-15)
  home_record?: string | null; // e.g., "25-10"
  road_record?: string | null; // e.g., "20-15"
  streak?: string | null; // e.g., "W5", "L2"
  updated_at?: string | null; // timestamptz

  // Joined from teams table
  team: Team;
}

/**
 * Flattened version for easier UI consumption
 * Combines standing data with team info in a flat structure
 */
export interface TeamStandingFlattened {
  id: string;
  teamId: string;
  season: string;
  rank: number; // conf_rank
  wins: number;
  losses: number;
  winPct: number;
  homeRecord?: string;
  roadRecord?: string;
  streak?: string;
  last10?: string;
  gamesBehind?: string;

  // Team info (flattened)
  teamName: string;
  teamNickname: string;
  teamCode: string;
  logoUrl: string | null;
  conference: "East" | "West";
  division: string;
  city: string;
}

/**
 * Database types (what Supabase returns)
 * Matches actual database schema
 */
export interface DatabaseTeamStanding {
  id: string | number; // int8
  team_id: string | number; // int4
  season: string;
  wins: number;
  losses: number;
  win_pct: number; // float8
  conf_rank: number;
  home_record?: string | null;
  road_record?: string | null;
  streak?: string | null;
  updated_at?: string | null; // timestamptz
  team: Team | null; // Supabase returns data with the alias 'team' (from team:teams!inner)
}

/**
 * Player information from the `players` table
 */
export interface Player {
  id: string | number;
  full_name: string;
  headshot_url: string | null;
  team_id: string | number | null;
  position?: string | null;
}

/**
 * Player season stats from the `player_season_stats` table
 * Schema: player_id, season, pts, reb, ast, stl, blk, fantasy_avg
 */
export interface PlayerSeasonStats {
  player_id: string | number;
  season: string;
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  fantasy_avg: number;
  player: Player | null;
  team: Team | null; // Joined from teams via player.team_id
}

/**
 * Database type for player_season_stats query result
 * Note: team is nested inside player in Supabase response
 */
export interface DatabasePlayerSeasonStats {
  player_id: string | number;
  season: string;
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  fantasy_avg: number;
  player: (Player & { team?: Team | null }) | null;
}
