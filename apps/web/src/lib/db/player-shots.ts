import { createServerClient, hasSupabaseConfig } from "./supabase-server";
import { PlayerFetchError } from "./players";
import { logger } from "@/config/env";

/**
 * Represents a single shot from the player_shots table
 */
export interface PlayerShot {
  loc_x: number;       // NBA coordinate X (-250 to 250)
  loc_y: number;       // NBA coordinate Y (-50 to ~800)
  shot_made_flag: boolean;
  shot_zone_basic: string | null;
}

/**
 * Fetch all shots for a specific player
 * 
 * @param playerId - The player's ID
 * @param season - Optional season filter (e.g., "2024-25")
 * @returns Promise<PlayerShot[]> Array of shot data
 */
export async function fetchPlayerShots(
  playerId: string | number,
  season?: string
): Promise<PlayerShot[]> {
  if (!playerId) {
    throw new PlayerFetchError("Player ID is required", "INVALID_PLAYER_ID");
  }

  if (!hasSupabaseConfig()) {
    logger.warn("[fetchPlayerShots] Supabase not configured, returning empty array");
    return [];
  }

  try {
    const supabase = createServerClient();

    let query = supabase
      .from("player_shots")
      .select("loc_x, loc_y, shot_made_flag, shot_zone_basic")
      .eq("player_id", playerId);

    // Apply season filter if provided
    if (season) {
      query = query.eq("season", season);
    }

    const { data, error } = await query;

    if (error) {
      logger.error("[fetchPlayerShots] Query error:", {
        message: error.message,
        code: error.code,
        playerId,
        season,
      });
      // Return empty array instead of throwing to gracefully handle missing table
      return [];
    }

    if (!data || data.length === 0) {
      logger.info(`[fetchPlayerShots] No shots found for player ${playerId}`);
      return [];
    }

    logger.info(`[fetchPlayerShots] Found ${data.length} shots for player ${playerId}`);

    // Transform to ensure correct types
    const shots: PlayerShot[] = data.map((shot) => ({
      loc_x: shot.loc_x ?? 0,
      loc_y: shot.loc_y ?? 0,
      shot_made_flag: shot.shot_made_flag ?? false,
      shot_zone_basic: shot.shot_zone_basic ?? null,
    }));

    return shots;
  } catch (error) {
    logger.error("[fetchPlayerShots] Unexpected error:", error);
    // Return empty array to gracefully handle errors
    return [];
  }
}
