import { supabase } from '@/lib/supabase';
import type { PlayerSeasonStats } from '@/types/nba';
import { DEFAULT_SEASON, DEFAULT_PAGE_SIZE, INITIAL_PAGE, PLAYER_SORT_CATEGORIES } from '@/config/constants';
import type { PlayerSortCategory } from '@/config/constants';
import { logger } from '@/config/env';

export interface FetchPlayerStatsOptions {
  page?: number;
  pageSize?: number;
  sortBy?: PlayerSortCategory;
  season?: string;
}

export interface FetchPlayerStatsResult {
  data: PlayerSeasonStats[] | null;
  error: Error | null;
}

/**
 * Custom error class for player stats fetching errors
 */
export class PlayerStatsFetchError extends Error {
  constructor(message: string, public readonly code?: string) {
    super(message);
    this.name = 'PlayerStatsFetchError';
  }
}

/**
 * Fetch player season stats from Supabase with pagination and sorting
 * 
 * Uses INNER JOIN with players table to ensure only valid players are returned,
 * and LEFT JOIN with teams table to get team information.
 * 
 * @param options - Query options (page, pageSize, sortBy, season)
 * @returns Promise with player stats data or error
 * 
 * @throws {PlayerStatsFetchError} When Supabase query fails
 */
export async function fetchPlayerStats(
  options: FetchPlayerStatsOptions = {}
): Promise<FetchPlayerStatsResult> {
  try {
    const {
      page = INITIAL_PAGE,
      pageSize = DEFAULT_PAGE_SIZE,
      sortBy = PLAYER_SORT_CATEGORIES.FANTASY_AVG,
      season = DEFAULT_SEASON,
    } = options;

    // Calculate pagination range
    const start = page * pageSize;
    const end = (page + 1) * pageSize - 1;

    // Build query with JOINs
    // Using !inner for players ensures we only get stats for valid players
    // Team is joined through player.team_id relationship
    const { data, error } = await supabase
      .from('player_season_stats')
      .select(`
        *,
        player:players!inner(
          *,
          team:teams(*)
        )
      `)
      .eq('season', season)
      .order(sortBy, { ascending: false })
      .range(start, end);

    if (error) {
      logger.error('[fetchPlayerStats] Supabase error:', error);
      logger.debug('[fetchPlayerStats] Error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      });
      return {
        data: null,
        error: new PlayerStatsFetchError(
          `Failed to fetch player stats: ${error.message}`,
          error.code
        ),
      };
    }

    logger.debug('[fetchPlayerStats] Query result:', {
      dataLength: data?.length ?? 0,
      page,
      pageSize,
      sortBy,
      season,
    });

    // Handle empty result
    if (!data || data.length === 0) {
      return {
        data: [],
        error: null,
      };
    }

    // Transform database result to PlayerSeasonStats
    // Supabase returns nested structure: { player: { team: {...} } }
    const stats: PlayerSeasonStats[] = data
      .map((item: unknown, index: number) => {
        const stat = item as {
          player_id: string | number;
          season: string;
          pts: number;
          reb: number;
          ast: number;
          stl: number;
          blk: number;
          fantasy_avg: number;
          player: {
            id: string | number;
            full_name: string;
            headshot_url: string | null;
            team_id: string | number | null;
            team?: {
              id: string | number;
              code: string;
            } | null;
          } | null;
        };

        // Log first item for debugging
        if (index === 0) {
          logger.debug('[fetchPlayerStats] Sample raw data:', {
            player_id: stat.player_id,
            player: stat.player,
            team: stat.player?.team,
          });
        }

        // Filter out items without player data
        if (!stat.player) {
          return null;
        }

        // Extract team from nested player.team structure
        const teamData = stat.player.team || null;

        return {
          player_id: String(stat.player_id),
          season: stat.season,
          pts: stat.pts,
          reb: stat.reb,
          ast: stat.ast,
          stl: stat.stl,
          blk: stat.blk,
          fantasy_avg: stat.fantasy_avg,
          player: stat.player
            ? {
                id: String(stat.player.id),
                full_name: stat.player.full_name,
                headshot_url: stat.player.headshot_url,
                team_id: stat.player.team_id ? String(stat.player.team_id) : null,
              }
            : null,
          team: teamData
            ? {
                id: String(teamData.id),
                code: teamData.code,
                name: '',
                nickname: '',
                city: '',
                logo_url: null,
                conference: 'East' as const,
                division: '',
              }
            : null,
        } as PlayerSeasonStats;
      })
      .filter((stat): stat is PlayerSeasonStats => stat !== null);

    logger.debug('[fetchPlayerStats] Transformed stats:', {
      count: stats.length,
      sample: stats[0] ? {
        player_id: stats[0].player_id,
        playerName: stats[0].player?.full_name,
        teamCode: stats[0].team?.code,
        fantasy_avg: stats[0].fantasy_avg,
      } : null,
    });

    return {
      data: stats,
      error: null,
    };
  } catch (err) {
    const error =
      err instanceof Error
        ? err
        : new Error('An unexpected error occurred while fetching player stats');
    
    logger.error('[fetchPlayerStats] Unexpected error:', error);
    
    return {
      data: null,
      error: error instanceof PlayerStatsFetchError 
        ? error 
        : new PlayerStatsFetchError(error.message),
    };
  }
}
