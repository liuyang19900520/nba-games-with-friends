/**
 * Fantasy Scoring Calculator
 * 
 * This utility can be used independently in other projects.
 * It uses the scoring rules from src/config/fantasy-scoring.json
 */

import fantasyScoringConfig from "@/config/fantasy-scoring.json";

export interface PlayerStats {
  pts: number;
  reb: number;
  ast: number;
  stl?: number;
  blk?: number;
  tov?: number;
}

export interface FantasyScoringConfig {
  version: string;
  description: string;
  rules: {
    [key: string]: {
      stat: string;
      coefficient: number;
      description: string;
    };
  };
  calculation: {
    formula: string;
    rounding?: {
      enabled: boolean;
      decimals: number;
    };
    minimum?: number;
    description: string;
  };
}

/**
 * Calculate fantasy points from player stats
 * 
 * @param stats - Player statistics (pts, reb, ast, stl, blk, tov)
 * @param customConfig - Optional custom scoring configuration (defaults to JSON config)
 * @returns Calculated fantasy score
 * 
 * @example
 * ```typescript
 * const score = calculateFantasyScore({
 *   pts: 25,
 *   reb: 10,
 *   ast: 8,
 *   stl: 2,
 *   blk: 1,
 *   tov: 3
 * });
 * // Returns: 55.0
 * ```
 */
export function calculateFantasyScore(
  stats: PlayerStats,
  customConfig?: FantasyScoringConfig
): number {
  const config = customConfig || (fantasyScoringConfig as FantasyScoringConfig);
  const rules = config.rules;
  const calcConfig = config.calculation;

  // Calculate score using coefficients from config
  const ptsScore = (stats.pts || 0) * rules.points.coefficient;
  const rebScore = (stats.reb || 0) * rules.rebounds.coefficient;
  const astScore = (stats.ast || 0) * rules.assists.coefficient;
  const stlScore = (stats.stl || 0) * rules.steals.coefficient;
  const blkScore = (stats.blk || 0) * rules.blocks.coefficient;
  const tovScore = (stats.tov || 0) * rules.turnovers.coefficient;

  let totalScore =
    ptsScore + rebScore + astScore + stlScore + blkScore + tovScore;

  // Apply minimum if configured
  if (calcConfig.minimum !== undefined && totalScore < calcConfig.minimum) {
    totalScore = calcConfig.minimum;
  }

  // Apply rounding if configured
  if (calcConfig.rounding?.enabled) {
    const decimals = calcConfig.rounding.decimals || 2;
    totalScore =
      Math.round(totalScore * Math.pow(10, decimals)) /
      Math.pow(10, decimals);
  }

  return totalScore;
}

/**
 * Get the scoring configuration
 * 
 * @returns The fantasy scoring configuration object
 */
export function getFantasyScoringConfig(): FantasyScoringConfig {
  return fantasyScoringConfig as FantasyScoringConfig;
}

/**
 * Calculate fantasy score for multiple players
 * 
 * @param players - Array of player stats
 * @param customConfig - Optional custom scoring configuration
 * @returns Array of fantasy scores in the same order as input
 */
export function calculateFantasyScores(
  players: PlayerStats[],
  customConfig?: FantasyScoringConfig
): number[] {
  return players.map((stats) => calculateFantasyScore(stats, customConfig));
}

/**
 * Calculate total fantasy score for a team/lineup
 * 
 * @param players - Array of player stats
 * @param customConfig - Optional custom scoring configuration
 * @returns Total fantasy score for all players
 */
export function calculateTotalFantasyScore(
  players: PlayerStats[],
  customConfig?: FantasyScoringConfig
): number {
  const scores = calculateFantasyScores(players, customConfig);
  return scores.reduce((sum, score) => sum + score, 0);
}
