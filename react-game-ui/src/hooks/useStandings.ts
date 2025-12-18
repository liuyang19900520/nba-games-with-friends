import { useState, useEffect, useCallback } from "react";
import {
  fetchStandings,
  transformStandingToLeaderboardEntry,
} from "@/services/standingService";
import type { TeamStanding } from "@/types/nba";
import type { LeaderboardEntry } from "@/types";
import {
  DEFAULT_SEASON,
  TEAM_SORT_OPTIONS,
  SORT_DIRECTIONS,
} from "@/config/constants";
import type {
  Conference,
  TeamSortOption,
  SortDirection,
} from "@/config/constants";
import { logger } from "@/config/env";

export interface UseStandingsOptions {
  season?: string;
  conference?: Conference;
  orderBy?: TeamSortOption;
  orderDirection?: SortDirection;
  enabled?: boolean; // Allow disabling the fetch (useful for conditional fetching)
}

export interface UseStandingsReturn {
  standings: TeamStanding[];
  leaderboardEntries: LeaderboardEntry[]; // Transformed for UI compatibility
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Custom React hook for fetching team standings
 *
 * @param options - Configuration options for fetching standings
 * @returns Object with standings data, loading state, error, and refetch function
 *
 * @example
 * // Basic usage
 * const { standings, loading, error } = useStandings();
 *
 * @example
 * // With filters
 * const { standings, loading, error, refetch } = useStandings({
 *   season: '2024-25',
 *   conference: 'West',
 * });
 */
export function useStandings(
  options: UseStandingsOptions = {}
): UseStandingsReturn {
  const {
    season = DEFAULT_SEASON,
    conference,
    orderBy = TEAM_SORT_OPTIONS.CONF_RANK,
    orderDirection = SORT_DIRECTIONS.ASC,
    enabled = true,
  } = options;

  const [standings, setStandings] = useState<TeamStanding[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await fetchStandings({
        season,
        conference,
        orderBy,
        orderDirection,
      });

      if (result.error) {
        logger.error("[useStandings] Error:", result.error.message);
        setError(result.error);
        setStandings([]);
      } else {
        setStandings(result.data || []);
        setError(null);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Unknown error");
      logger.error("[useStandings] Unexpected error:", error);
      setError(error);
      setStandings([]);
    } finally {
      setLoading(false);
    }
  }, [season, conference, orderBy, orderDirection, enabled]);

  // Fetch data on mount and when dependencies change
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const leaderboardEntries: LeaderboardEntry[] = standings.map((standing) => {
    const entry = transformStandingToLeaderboardEntry(standing);
    return {
      id: entry.id,
      rank: entry.rank,
      name: entry.name,
      value: entry.value,
      wins: entry.wins,
      losses: entry.losses,
      winPct: entry.winPct,
      streak: entry.streak,
      conference: entry.conference,
      logoUrl: entry.logoUrl,
    };
  });

  return {
    standings,
    leaderboardEntries,
    loading,
    error,
    refetch: fetchData,
  };
}
