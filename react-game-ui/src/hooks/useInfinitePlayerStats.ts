import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchPlayerStats } from '@/services/playerStatsService';
import type { PlayerSeasonStats } from '@/types/nba';
import { DEFAULT_SEASON, DEFAULT_PAGE_SIZE, PLAYER_SORT_CATEGORIES } from '@/config/constants';
import type { PlayerSortCategory } from '@/config/constants';
import { logger } from '@/config/env';

export interface UseInfinitePlayerStatsOptions {
  sortBy?: PlayerSortCategory;
  season?: string;
  pageSize?: number;
}

export interface UseInfinitePlayerStatsReturn {
  stats: PlayerSeasonStats[];
  loading: boolean;
  hasMore: boolean;
  error: Error | null;
  loadMore: () => Promise<void>;
  reset: () => void;
}

/**
 * Custom hook for infinite scrolling player stats
 * 
 * Manages pagination state and provides methods to load more data.
 * Automatically resets when sortBy changes.
 * 
 * @param options - Configuration options
 * @returns Object with stats array, loading state, hasMore flag, loadMore function, and reset function
 * 
 * @example
 * ```tsx
 * const { stats, loading, hasMore, loadMore, error } = useInfinitePlayerStats({
 *   sortBy: 'fantasy_avg',
 *   season: '2025-26',
 * });
 * ```
 */
export function useInfinitePlayerStats(
  options: UseInfinitePlayerStatsOptions = {}
): UseInfinitePlayerStatsReturn {
  const {
    sortBy = PLAYER_SORT_CATEGORIES.FANTASY_AVG,
    season = DEFAULT_SEASON,
    pageSize = DEFAULT_PAGE_SIZE,
  } = options;

  // State management
  const [stats, setStats] = useState<PlayerSeasonStats[]>([]);
  const [page, setPage] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false); // Start as false, will be set to true when loading starts
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  // Track current sortBy to detect changes
  const previousSortByRef = useRef<string>(sortBy);
  const hasLoadedRef = useRef<boolean>(false);

  /**
   * Reset state when sortBy changes
   * This ensures we start fresh when switching sort categories
   */
  useEffect(() => {
    if (previousSortByRef.current !== sortBy) {
      logger.debug('[useInfinitePlayerStats] SortBy changed, resetting:', {
        previous: previousSortByRef.current,
        current: sortBy,
      });
      previousSortByRef.current = sortBy;
      setStats([]);
      setPage(0);
      setHasMore(true);
      setError(null);
      setLoading(false);
      hasLoadedRef.current = false;
    }
  }, [sortBy]);

  /**
   * Load more data (next page)
   * Appends new results to existing stats array
   */
  const loadMore = useCallback(async () => {
    // Prevent concurrent requests
    if (loading || !hasMore) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const currentPage = page;
      logger.debug('[useInfinitePlayerStats] Loading page:', {
        page: currentPage,
        pageSize,
        sortBy,
        season,
      });

      const result = await fetchPlayerStats({
        page: currentPage,
        pageSize,
        sortBy,
        season,
      });

      logger.debug('[useInfinitePlayerStats] Fetch result:', {
        hasError: !!result.error,
        errorMessage: result.error?.message,
        dataLength: result.data?.length ?? 0,
        hasMore: (result.data?.length ?? 0) >= pageSize,
      });

      if (result.error) {
        logger.error('[useInfinitePlayerStats] Error:', result.error.message);
        setError(result.error);
        setHasMore(false);
        return;
      }

      const newStats = result.data || [];

      if (newStats.length === 0) {
        // No more data available
        logger.debug('[useInfinitePlayerStats] No data returned, setting hasMore to false');
        setHasMore(false);
      } else {
        // Append new stats to existing array
        setStats((prev) => {
          const updated = [...prev, ...newStats];
          logger.debug('[useInfinitePlayerStats] Updated stats:', {
            previousCount: prev.length,
            newCount: updated.length,
            added: newStats.length,
          });
          return updated;
        });

        // Check if we got less than pageSize, indicating no more data
        if (newStats.length < pageSize) {
          logger.debug('[useInfinitePlayerStats] Got less than pageSize, no more data');
          setHasMore(false);
        } else {
          // Increment page for next load
          setPage((prev) => {
            const nextPage = prev + 1;
            logger.debug('[useInfinitePlayerStats] Incrementing page:', { prev, nextPage });
            return nextPage;
          });
        }
      }
    } catch (err) {
      const error =
        err instanceof Error
          ? err
          : new Error('Unknown error occurred while loading player stats');
      
      logger.error('[useInfinitePlayerStats] Unexpected error:', error);
      setError(error);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, sortBy, season, loading, hasMore]);

  /**
   * Initial load on mount and after sortBy reset
   */
  useEffect(() => {
    logger.debug('[useInfinitePlayerStats] Initial load effect:', {
      statsLength: stats.length,
      hasMore,
      loading,
      hasLoaded: hasLoadedRef.current,
      shouldLoad: stats.length === 0 && hasMore && !loading && !hasLoadedRef.current,
    });
    
    if (stats.length === 0 && hasMore && !loading && !hasLoadedRef.current) {
      logger.debug('[useInfinitePlayerStats] Triggering initial loadMore...');
      hasLoadedRef.current = true;
      loadMore();
    }
  }, [stats.length, hasMore, loading, loadMore]);

  /**
   * Reset function to manually clear data and start over
   */
  const reset = useCallback(() => {
    setStats([]);
    setPage(0);
    setHasMore(true);
    setError(null);
    setLoading(true);
  }, []);

  return {
    stats,
    loading,
    hasMore,
    error,
    loadMore,
    reset,
  };
}
