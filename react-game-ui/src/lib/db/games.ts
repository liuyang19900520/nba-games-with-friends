import { unstable_cache } from "next/cache";
import { createServerClient, hasSupabaseConfig } from "./supabase-server";
import { logger } from "@/config/env";
import type { GameResult } from "@/types";

/**
 * Fetch recent game results
 *
 * Note: This assumes a `games` table exists in Supabase with the following structure:
 * - id (uuid or int)
 * - game_type (text)
 * - home_team_id (int4, foreign key to teams)
 * - away_team_id (int4, foreign key to teams)
 * - home_score (int4)
 * - away_score (int4)
 * - rating_count (int4, optional)
 * - game_date (date or timestamptz)
 *
 * If the table doesn't exist, this will return an empty array.
 */
export async function fetchRecentGames(
  limit: number = 10
): Promise<GameResult[]> {
  // Check if Supabase is configured
  if (!hasSupabaseConfig()) {
    logger.warn(
      "[fetchRecentGames] Supabase not configured, returning empty array"
    );
    return [];
  }

  try {
    const supabase = createServerClient();

    // First, try to fetch games data without joins to verify table exists and has data
    logger.info("[fetchRecentGames] Attempting to fetch games...");

    // Step 1: Try simple query first to check if table exists
    const { data: simpleData, error: simpleError } = await supabase
      .from("games")
      .select(
        "id, game_type, home_score, away_score, rating_count, game_date, home_team_id, away_team_id"
      )
      .order("game_date", { ascending: false })
      .limit(limit);

    if (simpleError) {
      logger.error("[fetchRecentGames] Simple query failed:", {
        message: simpleError.message,
        code: simpleError.code,
        hint: simpleError.hint,
      });

      if (
        simpleError.code === "42P01" ||
        simpleError.code === "PGRST116" ||
        simpleError.message.includes("does not exist") ||
        simpleError.message.includes("relation")
      ) {
        logger.warn("[fetchRecentGames] Games table does not exist");
        return [];
      }
      return [];
    }

    if (!simpleData || simpleData.length === 0) {
      logger.info("[fetchRecentGames] Games table exists but has no data");
      return [];
    }

    logger.info(
      `[fetchRecentGames] Found ${simpleData.length} games, fetching team details...`
    );

    // Step 2: Fetch team details separately and combine
    const teamIds = new Set<number>();
    simpleData.forEach(
      (game: { home_team_id?: number; away_team_id?: number }) => {
        if (game.home_team_id) teamIds.add(game.home_team_id);
        if (game.away_team_id) teamIds.add(game.away_team_id);
      }
    );

    const { data: teamsData, error: teamsError } = await supabase
      .from("teams")
      .select("id, name, code, logo_url")
      .in("id", Array.from(teamIds));

    if (teamsError) {
      logger.warn(
        "[fetchRecentGames] Failed to fetch teams, using game data without team details:",
        teamsError.message
      );
    }

    // Create a map of team data for quick lookup
    const teamsMap = new Map<
      string | number,
      {
        id: string | number;
        name: string;
        code: string;
        logo_url: string | null;
      }
    >();
    if (teamsData) {
      teamsData.forEach(
        (team: {
          id: string | number;
          name: string;
          code: string;
          logo_url: string | null;
        }) => {
          teamsMap.set(team.id, {
            id: team.id,
            name: team.name,
            code: team.code,
            logo_url: team.logo_url,
          });
        }
      );
    }

    // Transform to GameResult format
    const data = simpleData.map(
      (game: {
        id: string | number;
        game_type?: string;
        home_score?: number;
        away_score?: number;
        rating_count?: number;
        game_date?: string;
        home_team_id?: number;
        away_team_id?: number;
      }) => {
        const homeTeam = game.home_team_id
          ? teamsMap.get(game.home_team_id)
          : null;
        const awayTeam = game.away_team_id
          ? teamsMap.get(game.away_team_id)
          : null;

        return {
          id: String(game.id),
          gameType: game.game_type || "NBA Regular Season",
          homeTeam: {
            id: String(homeTeam?.id || game.home_team_id || ""),
            name: homeTeam?.name || "Unknown",
            code: homeTeam?.code || "UNK",
            logoUrl: homeTeam?.logo_url || null,
            score: game.home_score || 0,
          },
          awayTeam: {
            id: String(awayTeam?.id || game.away_team_id || ""),
            name: awayTeam?.name || "Unknown",
            code: awayTeam?.code || "UNK",
            logoUrl: awayTeam?.logo_url || null,
            score: game.away_score || 0,
          },
          ratingCount: game.rating_count || undefined,
          gameDate: game.game_date || undefined,
        };
      }
    );

    logger.info(
      `[fetchRecentGames] Successfully transformed ${data.length} games`
    );
    return data;
  } catch (err) {
    logger.error("[fetchRecentGames] Unexpected error:", err);
    return [];
  }
}

/**
 * Cached version of fetchRecentGames
 * Revalidates every 5 minutes
 */
export const getRecentGames = unstable_cache(
  async (limit: number = 10) => {
    return fetchRecentGames(limit);
  },
  ["recent-games"],
  {
    revalidate: 300, // 5 minutes
    tags: ["games"],
  }
);
