import { supabase } from "@/lib/supabase";

import { DEFAULT_SEASON } from "@/config/constants";
import { logger } from "@/config/env";
import type {
  DatabasePlayerSeasonStats,
  PlayerSeasonStats,
  Team,
} from "@/types/nba";

export interface FetchPlayerProfileOptions {
  playerId: number | string;
  season?: string;
}

export interface FetchPlayerProfileResult {
  data: PlayerSeasonStats | null;
  error: Error | null;
}

/**
 * Fetch player profile with season stats from Supabase
 *
 * Queries player_season_stats filtered by player_id and season,
 * with INNER JOIN to players table and teams table to get full player and team information.
 *
 * @param options - Query options (playerId, season)
 * @returns Promise with player profile data or error
 */
export async function fetchPlayerProfile(
  options: FetchPlayerProfileOptions
): Promise<FetchPlayerProfileResult> {
  try {
    const { playerId, season = DEFAULT_SEASON } = options;

    if (!playerId) {
      return {
        data: null,
        error: new Error("Player ID is required"),
      };
    }

    const { data, error } = await supabase
      .from("player_season_stats")
      .select(
        `
        *,
        player:players!inner (
          id,
          full_name,
          position,
          headshot_url,
          team_id,
          team:teams (
            city,
            name
          )
        )
      `
      )
      .eq("player_id", playerId)
      .eq("season", season)
      .single();

    if (error) {
      logger.error("[fetchPlayerProfile] Supabase error:", error);
      logger.debug("[fetchPlayerProfile] Error details:", {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      });
      return {
        data: null,
        error: new Error(`Failed to fetch player profile: ${error.message}`),
      };
    }

    logger.debug("[fetchPlayerProfile] Query result:", {
      playerId,
      season,
      hasData: !!data,
    });

    if (!data) {
      return {
        data: null,
        error: new Error("Player profile not found"),
      };
    }

    const stat = data as DatabasePlayerSeasonStats & {
      player: {
        id: string | number;
        full_name: string;
        position: string | null;
        headshot_url: string | null;
        team_id: string | number | null;
        team?: Team | null;
      } | null;
    };

    if (!stat.player) {
      return {
        data: null,
        error: new Error("Player information not found"),
      };
    }

    const playerProfile: PlayerSeasonStats = {
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
      team: stat.player.team || null,
    };

    return {
      data: playerProfile,
      error: null,
    };
  } catch (err) {
    logger.error("[fetchPlayerProfile] Unexpected error:", err);
    return {
      data: null,
      error:
        err instanceof Error
          ? err
          : new Error(
              "An unexpected error occurred while fetching player profile"
            ),
    };
  }
}
