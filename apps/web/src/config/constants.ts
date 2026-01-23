/**
 * Application-wide constants
 * 
 * Centralizes magic values to improve maintainability and reduce duplication.
 * This follows the DRY principle and makes it easier to update values across the app.
 */

/**
 * Default NBA season
 * Used across services, hooks, and components for data fetching
 */
export const DEFAULT_SEASON = '2025-26';

/**
 * Pagination defaults
 */
export const DEFAULT_PAGE_SIZE = 20;
export const INITIAL_PAGE = 0;

/**
 * Conference types
 */
export const CONFERENCES = {
  EAST: 'East',
  WEST: 'West',
  ALL: 'All',
} as const;

export type Conference = typeof CONFERENCES[keyof typeof CONFERENCES];

/**
 * Sort categories for player stats
 */
export const PLAYER_SORT_CATEGORIES = {
  FANTASY_AVG: 'fantasy_avg',
  PTS: 'pts',
  REB: 'reb',
  AST: 'ast',
  STL: 'stl',
  BLK: 'blk',
} as const;

export type PlayerSortCategory = typeof PLAYER_SORT_CATEGORIES[keyof typeof PLAYER_SORT_CATEGORIES];

/**
 * Sort options for team standings
 */
export const TEAM_SORT_OPTIONS = {
  CONF_RANK: 'conf_rank',
  WINS: 'wins',
  WIN_PCT: 'win_pct',
} as const;

export type TeamSortOption = typeof TEAM_SORT_OPTIONS[keyof typeof TEAM_SORT_OPTIONS];

/**
 * Sort directions
 */
export const SORT_DIRECTIONS = {
  ASC: 'asc',
  DESC: 'desc',
} as const;

export type SortDirection = typeof SORT_DIRECTIONS[keyof typeof SORT_DIRECTIONS];

