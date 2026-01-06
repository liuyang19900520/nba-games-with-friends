import { unstable_cache } from "next/cache";
import { createServerClient, hasSupabaseConfig } from "./supabase-server";
import { logger } from "@/config/env";
import { getGameDate } from "@/lib/utils/game-date";
import type { GameResult } from "@/types";

/**
 * Fetch recent game results
 *
 * Table structure (from DDL):
 * - id (text, primary key)
 * - season (text)
 * - game_date (timestamptz)
 * - status (text, default 'Scheduled')
 * - arena_name (text, optional)
 * - is_playoff (boolean, default false)
 * - home_team_id (bigint, foreign key to teams)
 * - away_team_id (bigint, foreign key to teams)
 * - home_score (integer, optional)
 * - away_score (integer, optional)
 * - created_at (timestamptz)
 * - updated_at (timestamptz)
 *
 * @param limit - Maximum number of games to return
 * @param gameDate - Optional game date to filter by. If not provided, uses configured date
 * @returns Promise<GameResult[]> Array of game results
 */
export async function fetchRecentGames(
  limit: number = 10,
  gameDate?: string | Date
): Promise<GameResult[]> {
  // If gameDate not provided, use configured date
  let targetDate: string | Date | undefined = gameDate;
  if (!targetDate) {
    targetDate = await getGameDate();
  }
  // Check if Supabase is configured
  if (!hasSupabaseConfig()) {
    logger.warn(
      "[fetchRecentGames] Supabase not configured, returning empty array"
    );
    return [];
  }

  try {
    const supabase = createServerClient();

    logger.info("[fetchRecentGames] Attempting to fetch games...");
    logger.info(`[fetchRecentGames] Query parameters: limit=${limit}${targetDate ? `, date=${typeof targetDate === 'string' ? targetDate : targetDate.toISOString().split('T')[0]}` : ''}`);

    // Step 1: First try the simplest query to verify table access
    logger.info("[fetchRecentGames] Step 1: Testing simple SELECT * query...");
    const { data: testData, error: testError } = await supabase
      .from("games")
      .select("*")
      .limit(1);

    if (testError) {
      logger.error("[fetchRecentGames] Simple SELECT * failed:", {
        message: testError.message,
        code: testError.code,
        hint: testError.hint,
        details: testError.details,
      });
    } else {
      logger.info(
        `[fetchRecentGames] Simple SELECT * succeeded. Found ${
          testData?.length || 0
        } rows.`
      );
      if (testData && testData.length > 0) {
        logger.info(
          "[fetchRecentGames] Sample row from SELECT *:",
          JSON.stringify(testData[0], null, 2)
        );
      }
    }

    // Step 2: Fetch games data with specific fields
    logger.info(
      "[fetchRecentGames] Step 2: Fetching with specific fields and ordering..."
    );
    type GameRow = {
      id: string;
      season?: string;
      game_date?: string;
      status?: string;
      is_playoff?: boolean;
      home_score?: number | null;
      away_score?: number | null;
      home_team_id?: number | null;
      away_team_id?: number | null;
    };

    // Build query with optional date filter
    let query = supabase
      .from("games")
      .select(
        "id, season, game_date, status, is_playoff, home_score, away_score, home_team_id, away_team_id"
      );

    // If gameDate is provided, filter by date
    if (targetDate) {
      const dateStr = typeof targetDate === 'string' ? targetDate : targetDate.toISOString().split('T')[0];
      const dateStart = new Date(dateStr + 'T00:00:00Z');
      const dateEnd = new Date(dateStart);
      dateEnd.setUTCDate(dateEnd.getUTCDate() + 1);
      
      query = query
        .gte("game_date", dateStart.toISOString())
        .lt("game_date", dateEnd.toISOString());
    }

    query = query
      .order("game_date", { ascending: false, nullsFirst: false })
      .limit(limit);

    logger.info(
      `[fetchRecentGames] Executing query with limit=${limit}${targetDate ? `, date=${typeof targetDate === 'string' ? targetDate : targetDate.toISOString().split('T')[0]}` : ''}`
    );

    const { data: simpleData, error: simpleError } = await query;

    if (simpleError) {
      logger.error("[fetchRecentGames] Query with specific fields failed:", {
        message: simpleError.message,
        code: simpleError.code,
        hint: simpleError.hint,
        details: simpleError.details,
      });

      // If simple SELECT * worked but this failed, it might be a field name issue
      if (!testError && testData && testData.length > 0) {
        logger.error(
          "[fetchRecentGames] SELECT * worked but specific field query failed. This suggests a field name mismatch."
        );
        logger.info(
          "[fetchRecentGames] Available fields in table:",
          Object.keys(testData[0])
        );
      }

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

    logger.info(
      `[fetchRecentGames] Query succeeded. Returned ${
        simpleData?.length || 0
      } rows.`
    );

    if (!simpleData || simpleData.length === 0) {
      logger.warn(
        "[fetchRecentGames] Query returned no data. This might be due to:"
      );
      logger.warn("  1. RLS (Row Level Security) policies blocking access");
      logger.warn(
        "  2. All game_date values are NULL (filtered out by nullsFirst: false)"
      );
      logger.warn("  3. Data doesn't match the query filters");

      // Try query without ordering to see if it's an ordering issue
      logger.info("[fetchRecentGames] Trying query without ordering...");
      const { data: noOrderData, error: noOrderError } = await supabase
        .from("games")
        .select(
          "id, season, game_date, status, is_playoff, home_score, away_score, home_team_id, away_team_id"
        )
        .limit(limit);

      if (noOrderError) {
        logger.error(
          "[fetchRecentGames] Query without ordering also failed:",
          noOrderError
        );
      } else {
        logger.info(
          `[fetchRecentGames] Query without ordering returned ${
            noOrderData?.length || 0
          } rows`
        );
        if (noOrderData && noOrderData.length > 0) {
          logger.info(
            "[fetchRecentGames] Sample row (no ordering):",
            JSON.stringify(noOrderData[0], null, 2)
          );
        }
      }

      return [];
    }

    logger.info(
      `[fetchRecentGames] Found ${simpleData.length} games, fetching team details...`
    );
    logger.info(
      "[fetchRecentGames] Raw game data (first row):",
      JSON.stringify(simpleData[0], null, 2)
    );
    logger.info(
      "[fetchRecentGames] All game IDs:",
      simpleData.map((g) => g.id).join(", ")
    );

    // Step 2: Fetch team details separately and combine
    const teamIds = new Set<number>();
    simpleData.forEach((game: GameRow) => {
      if (game.home_team_id !== null && game.home_team_id !== undefined) {
        teamIds.add(game.home_team_id);
      }
      if (game.away_team_id !== null && game.away_team_id !== undefined) {
        teamIds.add(game.away_team_id);
      }
    });

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
    const data = simpleData.map((game: GameRow) => {
      const homeTeam =
        game.home_team_id !== null && game.home_team_id !== undefined
          ? teamsMap.get(game.home_team_id)
          : null;
      const awayTeam =
        game.away_team_id !== null && game.away_team_id !== undefined
          ? teamsMap.get(game.away_team_id)
          : null;

      // Generate game type from season and is_playoff
      let gameType = "NBA Regular Season";
      if (game.is_playoff) {
        gameType = "NBA Playoffs";
      } else if (game.season) {
        gameType = `${game.season} Regular Season`;
      }

      return {
        id: String(game.id),
        gameType,
        status: game.status || undefined,
        homeTeam: {
          id: String(homeTeam?.id || game.home_team_id || ""),
          name: homeTeam?.name || "Unknown",
          code: homeTeam?.code || "UNK",
          logoUrl: homeTeam?.logo_url || null,
          score: game.home_score ?? 0,
        },
        awayTeam: {
          id: String(awayTeam?.id || game.away_team_id || ""),
          name: awayTeam?.name || "Unknown",
          code: awayTeam?.code || "UNK",
          logoUrl: awayTeam?.logo_url || null,
          score: game.away_score ?? 0,
        },
        ratingCount: undefined, // Not available in current schema
        gameDate: game.game_date || undefined,
      };
    });

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
 *
 * Note: If you're debugging and need fresh data, you can temporarily
 * call fetchRecentGames directly instead of getRecentGames to bypass cache.
 */
export const getRecentGames = unstable_cache(
  async (limit: number = 10, gameDate?: string | Date) => {
    logger.info(
      `[getRecentGames] Cache miss or expired, fetching fresh data (limit=${limit}${gameDate ? `, date=${typeof gameDate === 'string' ? gameDate : gameDate.toISOString().split('T')[0]}` : ''})`
    );
    return fetchRecentGames(limit, gameDate);
  },
  ["recent-games"],
  {
    revalidate: 300, // 5 minutes
    tags: ["games"],
  }
);
