import { unstable_cache } from "next/cache";
import { createServerClient, hasSupabaseConfig } from "./supabase-server";
import { logger } from "@/config/env";
import { getGameDate } from "@/lib/utils/game-date";

import type { GameResult } from "@/types";

/**
 * Fetch recent game results
 *
 * @param limit - Maximum number of games to return
 * @param gameDate - Optional game date (Tokyo timezone) to filter by. If not provided, uses configured date
 * @returns Promise<GameResult[]> Array of game results
 */
export async function fetchRecentGames(
  limit: number = 10,
  gameDate?: string | Date | string[]
): Promise<GameResult[]> {
  // If gameDate not provided, use configured date
  let targetDate: string | Date | string[] | undefined = gameDate;
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
    const dateQueryStr = Array.isArray(targetDate)
      ? targetDate.join(',')
      : (targetDate instanceof Date ? targetDate.toISOString().split('T')[0] : targetDate);
    logger.info(`[fetchRecentGames] Query parameters: limit=${limit}${targetDate ? `, date=${dateQueryStr}` : ''}`);

    // Step 2: Fetch games data with specific fields
    type GameRow = {
      id: string;
      season?: string;
      game_datetime?: string;
      game_date_tokyo?: string;
      game_time_tokyo?: string;
      is_time_tbd?: boolean;
      status?: string;
      is_playoff?: boolean;
      home_score?: number | null;
      away_score?: number | null;
      home_team_id?: number | null;
      away_team_id?: number | null;
    };

    // Build query with optional date filter
    let query = supabase
      .from("games_tokyo")
      .select(
        "id, season, game_datetime, game_date_tokyo, game_time_tokyo, is_time_tbd, status, is_playoff, home_score, away_score, home_team_id, away_team_id"
      );

    // If gameDate is provided, filter by Tokyo date directly
    if (targetDate) {
      if (Array.isArray(targetDate)) {
        query = query.in("game_date_tokyo", targetDate);
      } else {
        const dateStr = typeof targetDate === 'string' ? targetDate : targetDate.toISOString().split('T')[0];
        query = query.eq("game_date_tokyo", dateStr);
      }
    }

    query = query
      .order("game_datetime", { ascending: true, nullsFirst: false })
      .limit(limit);

    const { data: simpleData, error: simpleError } = await query;

    if (simpleError) {
      logger.error("[fetchRecentGames] Query failed:", simpleError);
      return [];
    }

    if (!simpleData || simpleData.length === 0) {
      return [];
    }

    // Step 2: Fetch team details
    const teamIds = new Set<number>();
    simpleData.forEach((game: GameRow) => {
      if (game.home_team_id !== null && game.home_team_id !== undefined) {
        teamIds.add(game.home_team_id);
      }
      if (game.away_team_id !== null && game.away_team_id !== undefined) {
        teamIds.add(game.away_team_id);
      }
    });

    const { data: teamsData } = await supabase
      .from("teams")
      .select("id, name, code, logo_url")
      .in("id", Array.from(teamIds));

    // Create a map of team data
    const teamsMap = new Map<number, { id: number; name: string; code: string; logo_url: string | null }>();
    if (teamsData) {
      teamsData.forEach((t) => teamsMap.set(t.id, t));
    }

    // Transform to GameResult format
    return simpleData.map((game: GameRow) => {
      const homeTeam = teamsMap.get(game.home_team_id || 0);
      const awayTeam = teamsMap.get(game.away_team_id || 0);
      const gameType = game.is_playoff ? "NBA Playoffs" : (game.season ? `${game.season} Regular Season` : "NBA Regular Season");

      return {
        id: String(game.id),
        gameType,
        status: game.status || undefined,
        isTimeTbd: game.is_time_tbd || false,
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
        gameDate: game.game_datetime,
        gameDateTokyo: game.game_date_tokyo,
      };
    });
  } catch (err) {
    logger.error("[fetchRecentGames] Unexpected error:", err);
    return [];
  }
}

/**
 * Cached version of fetchRecentGames
 */
export const getRecentGames = unstable_cache(
  async (limit: number = 10, gameDate?: string | Date | string[]) => {
    return fetchRecentGames(limit, gameDate);
  },
  ["recent-games"],
  {
    revalidate: 10,
    tags: ["games"],
  }
);
