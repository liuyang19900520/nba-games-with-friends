import { supabase } from '@/lib/supabase';
import type { TeamStanding, DatabaseTeamStanding } from '@/types/nba';
import { DEFAULT_SEASON, CONFERENCES, TEAM_SORT_OPTIONS, SORT_DIRECTIONS } from '@/config/constants';
import type { Conference, TeamSortOption, SortDirection } from '@/config/constants';
import { logger } from '@/config/env';

/**
 * Service layer for fetching team standings data from Supabase
 * 
 * Handles the JOIN between team_standings and teams tables,
 * filters, sorting, and error handling.
 */

export interface FetchStandingsOptions {
  season?: string;
  conference?: Conference;
  orderBy?: TeamSortOption;
  orderDirection?: SortDirection;
}

export interface FetchStandingsResult {
  data: TeamStanding[] | null;
  error: Error | null;
}

/**
 * Fetch team standings from Supabase
 * 
 * @param options - Query options (season, conference, ordering)
 * @returns Promise with standings data or error
 * 
 */
export async function fetchStandings(
  options: FetchStandingsOptions = {}
): Promise<FetchStandingsResult> {
  try {
    const {
      season = DEFAULT_SEASON,
      conference,
      orderBy = TEAM_SORT_OPTIONS.CONF_RANK,
      orderDirection = SORT_DIRECTIONS.ASC,
    } = options;

    // Build the query with INNER JOIN
    // Using Supabase's select syntax with !inner keyword to perform Inner Join
    // This ensures we only get standings where the joined team exists and satisfies filter conditions
    // Matching actual database schema:
    // team_standings: id, team_id, season, wins, losses, win_pct, conf_rank, home_record, road_record, streak, updated_at
    // teams: id, name, nickname, code, city, logo_url, conference, division, primary_color, created_at
    let query = supabase
      .from('team_standings')
      .select(`
        id,
        team_id,
        season,
        wins,
        losses,
        win_pct,
        conf_rank,
        home_record,
        road_record,
        streak,
        updated_at,
        team:teams!inner (
          id,
          name,
          nickname,
          code,
          city,
          logo_url,
          conference,
          division,
          primary_color
        )
      `)
      .eq('season', season)
      .order(orderBy, { ascending: orderDirection === 'asc' });

    if (conference && conference !== CONFERENCES.ALL) {
      query = query.eq('teams.conference', conference);
    }
    
    const { data, error } = await query;

    if (error) {
      logger.error('[fetchStandings] Error:', error.message);
      return {
        data: null,
        error: new Error(`Failed to fetch standings: ${error.message}`),
      };
    }

    if (!data || data.length === 0) {
      return {
        data: [],
        error: null,
      };
    }

    const standings = (data as unknown as DatabaseTeamStanding[])
      .filter((standing) => standing.team !== null)
      .map((standing) => {
        // Transform to TeamStanding type
        // Convert numeric IDs to strings (Supabase may return numbers)
        // Note: Supabase returns joined data with the alias 'team' (as defined in select)
        return {
          id: String(standing.id),
          team_id: String(standing.team_id),
          season: standing.season,
          wins: standing.wins,
          losses: standing.losses,
          win_pct: standing.win_pct,
          conf_rank: standing.conf_rank,
          home_record: standing.home_record ?? undefined,
          road_record: standing.road_record ?? undefined,
          streak: standing.streak ?? undefined,
          updated_at: standing.updated_at ?? undefined,
          team: {
            ...standing.team!,
            id: String(standing.team!.id),
          },
        } as TeamStanding;
      });

    return {
      data: standings,
      error: null,
    };
  } catch (err) {
    logger.error('Unexpected error fetching standings:', err);
    return {
      data: null,
      error:
        err instanceof Error
          ? err
          : new Error('An unexpected error occurred while fetching standings'),
    };
  }
}

/**
 * Transform TeamStanding to LeaderboardEntry format for UI compatibility
 * This helper makes it easy to use standings data in existing components
 */
export function transformStandingToLeaderboardEntry(
  standing: TeamStanding
): {
  id: string;
  rank: number;
  name: string;
  value: number;
  wins: number;
  losses: number;
  winPct: number;
  streak?: string;
  conference: 'East' | 'West';
  logoUrl?: string;
} {
  return {
    id: standing.team_id,
    rank: standing.conf_rank,
    name: standing.team.nickname || standing.team.name,
    value: standing.wins,
    wins: standing.wins,
    losses: standing.losses,
    winPct: standing.win_pct,
    streak: standing.streak ?? undefined,
    conference: standing.team.conference,
    logoUrl: standing.team.logo_url ?? undefined,
  };
}

