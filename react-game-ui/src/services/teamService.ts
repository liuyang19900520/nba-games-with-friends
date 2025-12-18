import { supabase } from "@/lib/supabase";

import { DEFAULT_SEASON } from "@/config/constants";
import { logger } from "@/config/env";
import type {
  DatabasePlayerSeasonStats,
  PlayerSeasonStats,
  Team,
  TeamStanding,
} from "@/types/nba";

export interface FetchTeamRosterOptions {
  teamId: number;
  season?: string;
}

export interface FetchTeamRosterResult {
  data: PlayerSeasonStats[] | null;
  error: Error | null;
}

export interface FetchTeamInfoOptions {
  teamId: number;
  season?: string;
}

export interface FetchTeamInfoResult {
  data: { team: Team; standing: TeamStanding | null } | null;
  error: Error | null;
}

/**
 * Fetch team roster with player stats from Supabase
 *
 * Queries player_season_stats filtered by team_id and season,
 * with INNER JOIN to players table to get player information.
 *
 * @param options - Query options (teamId, season)
 * @returns Promise with roster data or error
 */
export async function fetchTeamRoster(
  options: FetchTeamRosterOptions
): Promise<FetchTeamRosterResult> {
  try {
    const { teamId, season = DEFAULT_SEASON } = options;

    if (!teamId) {
      return {
        data: null,
        error: new Error("Team ID is required"),
      };
    }

    const { data, error } = await supabase
      .from("player_season_stats")
      .select(
        `
        *,
        player:players!inner(
          id,
          full_name,
          headshot_url,
          position,
          team_id
        )
      `
      )
      .eq("team_id", teamId)
      .eq("season", season);

    if (error) {
      logger.error("[fetchTeamRoster] Supabase error:", error);
      logger.debug("[fetchTeamRoster] Error details:", {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      });
      return {
        data: null,
        error: new Error(`Failed to fetch team roster: ${error.message}`),
      };
    }

    logger.debug("[fetchTeamRoster] Query result:", {
      dataLength: data?.length ?? 0,
      teamId,
      season,
    });

    if (!data || data.length === 0) {
      return {
        data: [],
        error: null,
      };
    }

    const roster: PlayerSeasonStats[] = data
      .map((item: unknown) => {
        const stat = item as DatabasePlayerSeasonStats & {
          player: {
            id: string | number;
            full_name: string;
            headshot_url: string | null;
            position: string | null;
            team_id: string | number | null;
          } | null;
        };

        if (!stat.player) {
          return null;
        }

        return {
          player_id: String(stat.player_id),
          season: stat.season,
          pts: stat.pts,
          reb: stat.reb,
          ast: stat.ast,
          stl: stat.stl,
          blk: stat.blk,
          fantasy_avg: stat.fantasy_avg,
          player: {
            id: String(stat.player.id),
            full_name: stat.player.full_name,
            headshot_url: stat.player.headshot_url,
            team_id: stat.player.team_id ? String(stat.player.team_id) : null,
            position: stat.player.position || null,
          },
          team: null,
        } as PlayerSeasonStats;
      })
      .filter((item): item is PlayerSeasonStats => item !== null);

    return {
      data: roster,
      error: null,
    };
  } catch (err) {
    logger.error("[fetchTeamRoster] Unexpected error:", err);
    return {
      data: null,
      error:
        err instanceof Error
          ? err
          : new Error(
              "An unexpected error occurred while fetching team roster"
            ),
    };
  }
}

/**
 * Fetch team information and standing from Supabase
 *
 * @param options - Query options (teamId, season)
 * @returns Promise with team data and standing or error
 */
export async function fetchTeamInfo(
  options: FetchTeamInfoOptions
): Promise<FetchTeamInfoResult> {
  try {
    const { teamId, season = DEFAULT_SEASON } = options;

    if (!teamId) {
      return {
        data: null,
        error: new Error("Team ID is required"),
      };
    }

    const { data: teamData, error: teamError } = await supabase
      .from("teams")
      .select("*")
      .eq("id", teamId)
      .single();

    if (teamError) {
      logger.error("[fetchTeamInfo] Team fetch error:", teamError);
      return {
        data: null,
        error: new Error(`Failed to fetch team info: ${teamError.message}`),
      };
    }

    if (!teamData) {
      return {
        data: null,
        error: new Error("Team not found"),
      };
    }

    const { data: standingData, error: standingError } = await supabase
      .from("team_standings")
      .select("*")
      .eq("team_id", teamId)
      .eq("season", season)
      .single();

    if (standingError && standingError.code !== "PGRST116") {
      logger.warn(
        "[fetchTeamInfo] Standing fetch error (non-critical):",
        standingError
      );
    }

    const team: Team = {
      id: String(teamData.id),
      name: teamData.name,
      nickname: teamData.nickname,
      code: teamData.code,
      city: teamData.city,
      logo_url: teamData.logo_url,
      conference: teamData.conference as "East" | "West",
      division: teamData.division,
      primary_color: teamData.primary_color,
      created_at: teamData.created_at,
    };

    const standing: TeamStanding | null = standingData
      ? {
          id: String(standingData.id),
          team_id: String(standingData.team_id),
          season: standingData.season,
          wins: standingData.wins,
          losses: standingData.losses,
          win_pct: standingData.win_pct,
          conf_rank: standingData.conf_rank,
          home_record: standingData.home_record,
          road_record: standingData.road_record,
          streak: standingData.streak,
          updated_at: standingData.updated_at,
          team,
        }
      : null;

    return {
      data: { team, standing },
      error: null,
    };
  } catch (err) {
    logger.error("[fetchTeamInfo] Unexpected error:", err);
    return {
      data: null,
      error:
        err instanceof Error
          ? err
          : new Error("An unexpected error occurred while fetching team info"),
    };
  }
}
