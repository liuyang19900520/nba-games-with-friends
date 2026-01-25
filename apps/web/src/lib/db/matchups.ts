import { createServerClient, hasSupabaseConfig } from "./supabase-server";
import { logger } from "@/config/env";
import { getGameDate } from "@/lib/utils/game-date";
import { calculateFantasyScore } from "@/lib/utils/fantasy-scoring";

/**
 * Player data for matchups page starting 5
 */
export interface MatchupPlayer {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  position: string;
  teamLogo: string;
  avatar: string;
  status: "LIVE" | "FINAL";
  pts: number;
  reb: number;
  ast: number;
  fpts: number;
}

/**
 * Fetch user's lineup with player stats for matchups page
 */
export async function fetchMatchupLineup(
  userId: string,
  gameDate?: string
): Promise<{
  players: MatchupPlayer[];
  totalScore: number;
  lineupId: number | null;
} | null> {
  if (!hasSupabaseConfig()) {
    logger.warn("[fetchMatchupLineup] Supabase not configured");
    return null;
  }

  try {
    const supabase = createServerClient();

    // Verify we're using service role (should bypass RLS)
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      logger.error(
        "[fetchMatchupLineup] SUPABASE_SERVICE_ROLE_KEY not set! This will cause RLS issues."
      );
      return {
        players: [],
        totalScore: 0,
        lineupId: null,
      };
    }
    logger.info(
      `[fetchMatchupLineup] Using service role key (first 10 chars: ${serviceRoleKey.substring(
        0,
        10
      )}...)`
    );
    
    // Decode JWT to check if it's actually a service_role key
    try {
      const parts = serviceRoleKey.split('.');
      if (parts.length === 3 && parts[1]) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
        logger.info(`[fetchMatchupLineup] JWT payload role: ${payload.role || 'unknown'}`);
        logger.info(`[fetchMatchupLineup] JWT payload iss: ${payload.iss || 'unknown'}`);
        if (payload.role !== 'service_role') {
          logger.error(`[fetchMatchupLineup] ⚠️ WARNING: This key is NOT a service_role key! It's a "${payload.role}" key.`);
        } else {
          logger.info(`[fetchMatchupLineup] ✅ Key is correctly identified as service_role`);
        }
      }
    } catch (e) {
      logger.warn(`[fetchMatchupLineup] Could not decode JWT:`, e);
    }

    // Get configured game date
    const targetDate = gameDate || (await getGameDate());

    logger.info(
      `[fetchMatchupLineup] Fetching lineup for user ${userId} on ${targetDate}`
    );
    logger.info(
      `[fetchMatchupLineup] Date source: gameDate param=${
        gameDate || "none"
      }, getGameDate()=${await getGameDate()}`
    );

    // Convert userId to string to ensure format matches (do this early)
    const userIdStr = String(userId);
    logger.info(
      `[fetchMatchupLineup] Querying with userId: ${userIdStr} (original: ${userId}, type: ${typeof userId})`
    );

    // 1. First, let's check what lineups exist for this user (for debugging)
    // Try without user_id filter first to see if RLS is blocking
    // Use RPC or direct query to bypass potential RLS issues
    logger.info(
      `[fetchMatchupLineup] Attempting to query user_daily_lineups table directly`
    );

    // Try using RPC call to bypass RLS if needed
    // First, let's try a simple query to see if we can access the table at all
    // IMPORTANT: Service Role Key should bypass RLS, but if it doesn't, we need to check RLS policies
    logger.info(
      `[fetchMatchupLineup] Service Role Key configured: ${!!serviceRoleKey}`
    );
    logger.info(
      `[fetchMatchupLineup] Supabase URL: ${process.env.SUPABASE_URL?.substring(
        0,
        30
      )}...`
    );
    
    // Check what role we're actually using
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      logger.info(
        `[fetchMatchupLineup] Auth check: user=${authData?.user?.id || 'null'}, error=${authError?.message || 'none'}`
      );
      
      // Try to get session info
      const { data: sessionData } = await supabase.auth.getSession();
      logger.info(
        `[fetchMatchupLineup] Session: exists=${!!sessionData?.session}, access_token length=${sessionData?.session?.access_token?.length || 0}`
      );
    } catch (authCheckError) {
      logger.warn(`[fetchMatchupLineup] Auth check failed:`, authCheckError);
    }

    // First, try querying the specific ID we know exists (id=5)
    // This will help us determine if RLS is blocking or if there's another issue
    // Use RPC or direct query to test access
    logger.info(`[fetchMatchupLineup] Testing direct query with Service Role Key`);
    
    // Try a simple query first to verify access
    const { data: testQuery, error: testError } = await supabase
      .from("user_daily_lineups")
      .select("id")
      .limit(1);
    
    if (testError) {
      logger.error(`[fetchMatchupLineup] Test query failed:`, {
        message: testError.message,
        code: testError.code,
        details: testError.details,
        hint: testError.hint,
      });
    } else {
      logger.info(`[fetchMatchupLineup] Test query succeeded, found ${testQuery?.length || 0} rows`);
    }
    
    const { data: specificLineup, error: specificError } = await supabase
      .from("user_daily_lineups")
      .select("id, user_id, game_date, status, total_score")
      .eq("id", 5) // We know this ID exists from the CSV
      .maybeSingle();

    if (specificError) {
      logger.error("[fetchMatchupLineup] Error querying specific ID 5:", {
        message: specificError.message,
        code: specificError.code,
        details: specificError.details,
        hint: specificError.hint,
      });
    } else if (specificLineup) {
      logger.info(
        `[fetchMatchupLineup] ✅ Successfully queried specific ID 5: user_id=${specificLineup.user_id}, game_date=${specificLineup.game_date}, status=${specificLineup.status}`
      );
      logger.info(
        `[fetchMatchupLineup] User ID from DB: ${
          specificLineup.user_id
        } (type: ${typeof specificLineup.user_id})`
      );
      logger.info(
        `[fetchMatchupLineup] Target User ID: ${userIdStr} (type: ${typeof userIdStr})`
      );
      logger.info(
        `[fetchMatchupLineup] User ID match: ${
          String(specificLineup.user_id) === userIdStr
        }`
      );
    } else {
      logger.warn(
        "[fetchMatchupLineup] ❌ Specific ID 5 query returned null - RLS is definitely blocking or data doesn't exist"
      );
    }

    const {
      data: allLineupsWithoutFilter,
      error: allError,
      count: totalCount,
    } = await supabase
      .from("user_daily_lineups")
      .select("id, user_id, game_date, status, total_score", { count: "exact" })
      .limit(10);

    if (allError) {
      logger.error(
        "[fetchMatchupLineup] Error fetching all lineups (no filter):",
        {
          message: allError.message,
          code: allError.code,
          details: allError.details,
          hint: allError.hint,
        }
      );
    } else {
      logger.info(
        `[fetchMatchupLineup] All lineups (no filter): ${
          allLineupsWithoutFilter?.length || 0
        } rows (total count: ${totalCount ?? "unknown"}). Sample user_ids: ${
          allLineupsWithoutFilter
            ?.slice(0, 3)
            .map((l) => `${l.user_id} (${typeof l.user_id})`)
            .join(", ") || "none"
        }`
      );

      // Check if our target user_id exists in the results
      if (allLineupsWithoutFilter) {
        const matchingUser = allLineupsWithoutFilter.find(
          (l) => String(l.user_id) === userIdStr
        );
        if (matchingUser) {
          logger.info(
            `[fetchMatchupLineup] Found matching user_id in unfiltered results! Date: ${matchingUser.game_date}, Status: ${matchingUser.status}`
          );
        } else {
          logger.warn(
            `[fetchMatchupLineup] User ${userIdStr} not found in unfiltered results. Available user_ids: ${allLineupsWithoutFilter
              .map((l) => l.user_id)
              .join(", ")}`
          );
        }
      }
    }

    // Now try with user_id filter
    const { data: allLineups, error: debugError } = await supabase
      .from("user_daily_lineups")
      .select("id, user_id, game_date, status, total_score")
      .eq("user_id", userIdStr)
      .order("game_date", { ascending: false })
      .limit(5);

    if (debugError) {
      logger.error(
        "[fetchMatchupLineup] Error fetching all lineups for debug:",
        {
          message: debugError.message,
          code: debugError.code,
          details: debugError.details,
          hint: debugError.hint,
          userId,
        }
      );
      // If there's an error (especially RLS), we should still try the exact match query
      // but log the error for debugging
    } else {
      logger.info(
        `[fetchMatchupLineup] User has ${
          allLineups?.length || 0
        } lineups. Dates: ${
          allLineups
            ?.map((l) => {
              const date = l.game_date;
              return date instanceof Date
                ? date.toISOString().split("T")[0]
                : String(date).split("T")[0];
            })
            .join(", ") || "none"
        }`
      );
    }

    // Check if data is null (might indicate RLS blocking)
    if (allLineups === null && !debugError) {
      logger.warn(
        "[fetchMatchupLineup] allLineups is null but no error - possible RLS issue"
      );
    }

    // 2. Try to find lineup - first try exact date match, then try to find latest
    type LineupRow = {
      id: number;
      total_score: number;
      status: string;
      game_date: string | Date;
    };
    let lineup: LineupRow | null = null;

    // Try exact date match first
    // Note: PostgreSQL DATE type should match YYYY-MM-DD format
    logger.info(
      `[fetchMatchupLineup] Querying with user_id=${userId} (type: ${typeof userId}), game_date=${targetDate} (type: ${typeof targetDate})`
    );

    // Try multiple date formats in case of format mismatch
    const dateFormats = [
      targetDate, // YYYY-MM-DD
      new Date(targetDate).toISOString().split("T")[0], // Ensure ISO format
    ];

    let exactLineup = null;
    let exactError = null;

    for (const dateFormat of dateFormats) {
      logger.info(`[fetchMatchupLineup] Trying date format: ${dateFormat}`);
      const { data, error } = await supabase
        .from("user_daily_lineups")
        .select("id, total_score, status, game_date, user_id")
        .eq("user_id", userIdStr)
        .eq("game_date", dateFormat)
        .maybeSingle(); // Use maybeSingle instead of single to avoid error on no rows

      if (data && !error) {
        exactLineup = data;
        logger.info(
          `[fetchMatchupLineup] Found lineup with date format: ${dateFormat}`
        );
        break;
      } else if (error && error.code !== "PGRST116") {
        exactError = error;
        logger.warn(
          `[fetchMatchupLineup] Error with date format ${dateFormat}:`,
          error
        );
      }
    }

    // If still no result, try without .single() to see all matches
    if (!exactLineup && !exactError) {
      const { data: allMatches, error: matchError } = await supabase
        .from("user_daily_lineups")
        .select("id, total_score, status, game_date, user_id")
        .eq("user_id", userIdStr);

      if (matchError) {
        logger.error(
          "[fetchMatchupLineup] Error fetching all matches:",
          matchError
        );
      } else {
        logger.info(
          `[fetchMatchupLineup] All lineups for user (no date filter): ${
            allMatches?.length || 0
          } rows. Dates: ${
            allMatches
              ?.map((l) => `${l.game_date} (${typeof l.game_date})`)
              .join(", ") || "none"
          }`
        );
      }

      if (allMatches && allMatches.length > 0) {
        logger.info(
          `[fetchMatchupLineup] Comparing dates: target=${targetDate}, available dates in DB: ${allMatches
            .map((l) => {
              const dbDate =
                l.game_date instanceof Date
                  ? l.game_date.toISOString().split("T")[0]
                  : String(l.game_date).split("T")[0];
              return `${dbDate} (raw: ${l.game_date})`;
            })
            .join(", ")}`
        );

        // Try to find by string comparison
        const match = allMatches.find((l) => {
          const dbDate =
            l.game_date instanceof Date
              ? l.game_date.toISOString().split("T")[0]
              : String(l.game_date).split("T")[0];
          const matches = dbDate === targetDate;
          logger.info(
            `[fetchMatchupLineup] Comparing: DB date "${dbDate}" === target "${targetDate}" = ${matches}`
          );
          return matches;
        });

        if (match) {
          exactLineup = match;
          logger.info(
            `[fetchMatchupLineup] ✅ Found lineup by string comparison: id=${match.id}, date=${match.game_date}`
          );
        } else {
          logger.warn(
            `[fetchMatchupLineup] ❌ No date match found. Target: ${targetDate}, Available: ${allMatches
              .map((l) => {
                const dbDate =
                  l.game_date instanceof Date
                    ? l.game_date.toISOString().split("T")[0]
                    : String(l.game_date).split("T")[0];
                return dbDate;
              })
              .join(", ")}`
          );

          // If no exact match, use the latest lineup as fallback
          if (allMatches.length > 0 && allMatches[0]) {
            const latest = allMatches[0];
            logger.info(
              `[fetchMatchupLineup] Using latest lineup as fallback: id=${latest.id}, date=${latest.game_date}`
            );
            exactLineup = latest;
          }
        }
      }
    }

    logger.info(
      `[fetchMatchupLineup] Exact query result: data=${
        exactLineup ? `found id=${exactLineup.id}` : "null"
      }, error=${
        exactError ? `${exactError.code}: ${exactError.message}` : "none"
      }`
    );

    if (exactError) {
      if (exactError.code === "PGRST116") {
        // No rows found - this is expected
        logger.info(
          `[fetchMatchupLineup] No exact match for date ${targetDate}`
        );
      } else {
        // Other error (possibly RLS)
        logger.error("[fetchMatchupLineup] Error fetching exact lineup:", {
          message: exactError.message,
          code: exactError.code,
          details: exactError.details,
          hint: exactError.hint,
          userId,
          targetDate,
        });
        // Don't return early - try to use allLineups if available
      }
    }

    if (exactLineup) {
      lineup = exactLineup as LineupRow;
      logger.info(
        `[fetchMatchupLineup] Found exact match lineup ${lineup.id} for date ${targetDate}`
      );
    } else if (allLineups && allLineups.length > 0 && allLineups[0]) {
      // If no exact match, use the latest lineup
      const latestLineup = allLineups[0];
      lineup = latestLineup as LineupRow;
      const lineupId = lineup.id;
      const lineupDate = latestLineup.game_date;
      logger.info(
        `[fetchMatchupLineup] No exact match for ${targetDate}, using latest lineup ${lineupId} from ${lineupDate}`
      );
    }

    if (!lineup) {
      logger.info(`[fetchMatchupLineup] No lineup found for user ${userId}`);
      return {
        players: [],
        totalScore: 0,
        lineupId: null,
      };
    }

    // TypeScript now knows lineup is not null
    const finalLineup: LineupRow = lineup;

    logger.info(
      `[fetchMatchupLineup] Found lineup ${finalLineup.id} with status ${finalLineup.status}, total_score: ${finalLineup.total_score}`
    );

    // 2. Fetch lineup items (5 players)
    const { data: lineupItems, error: itemsError } = await supabase
      .from("lineup_items")
      .select("player_id, position, fantasy_score")
      .eq("lineup_id", finalLineup.id)
      .order("position");

    logger.info(
      `[fetchMatchupLineup] Found ${
        lineupItems?.length || 0
      } lineup items for lineup ${finalLineup.id}`
    );

    if (itemsError) {
      logger.error(
        "[fetchMatchupLineup] Error fetching lineup items:",
        itemsError
      );
      return {
        players: [],
        totalScore: finalLineup.total_score || 0,
        lineupId: finalLineup.id,
      };
    }

    if (!lineupItems || lineupItems.length === 0) {
      logger.info("[fetchMatchupLineup] No lineup items found");
      return {
        players: [],
        totalScore: finalLineup.total_score || 0,
        lineupId: finalLineup.id,
      };
    }

    const playerIds = lineupItems.map((item) => item.player_id);

    // 3. Fetch player basic info with team data
    const { data: playersData, error: playersError } = await supabase
      .from("players")
      .select(
        `
        id,
        full_name,
        position,
        headshot_url,
        jersey_num,
        team_id,
        team:teams(
          name,
          code,
          logo_url
        )
      `
      )
      .in("id", playerIds);

    if (playersError) {
      logger.error(
        "[fetchMatchupLineup] Error fetching players:",
        playersError
      );
      return {
        players: [],
        totalScore: finalLineup.total_score || 0,
        lineupId: finalLineup.id,
      };
    }

    if (!playersData || playersData.length === 0) {
      logger.warn("[fetchMatchupLineup] No players found");
      return {
        players: [],
        totalScore: finalLineup.total_score || 0,
        lineupId: finalLineup.id,
      };
    }

    // 4. Fetch game_player_stats for these players on the target date
    // Use games_tokyo view for direct Tokyo date filtering
    const { data: gamesData, error: gamesError } = await supabase
      .from("games_tokyo")
      .select("id, status")
      .eq("game_date_tokyo", targetDate);

    if (gamesError) {
      logger.error("[fetchMatchupLineup] Error fetching games:", gamesError);
    }

    const gameIds = (gamesData || []).map((game) => game.id);
    const gameStatusMap = new Map(
      (gamesData || []).map((game) => [game.id, game.status])
    );

    // Fetch player stats for these games
    let playerStatsMap = new Map<
      number,
      {
        pts: number;
        reb: number;
        ast: number;
        stl?: number;
        blk?: number;
        tov?: number;
        fantasy_score: number;
        game_status: string;
      }
    >();

    if (gameIds.length > 0) {
      const { data: statsData, error: statsError } = await supabase
        .from("game_player_stats")
        .select("player_id, pts, reb, ast, stl, blk, tov, fantasy_score, game_id")
        .in("player_id", playerIds)
        .in("game_id", gameIds);

      if (statsError) {
        logger.error(
          "[fetchMatchupLineup] Error fetching player stats:",
          statsError
        );
      } else if (statsData) {
        // Map stats by player_id (take the latest game if multiple)
        for (const stat of statsData) {
          const existing = playerStatsMap.get(stat.player_id);
          
          // Calculate fantasy score from stats
          const calculatedFantasyScore = calculateFantasyScore({
            pts: stat.pts || 0,
            reb: stat.reb || 0,
            ast: stat.ast || 0,
            stl: stat.stl || 0,
            blk: stat.blk || 0,
            tov: stat.tov || 0,
          });
          
          // Use calculated score if available, otherwise fall back to database value
          const fantasyScore = calculatedFantasyScore > 0 
            ? calculatedFantasyScore 
            : (stat.fantasy_score || 0);
          
          if (!existing || fantasyScore > existing.fantasy_score) {
            playerStatsMap.set(stat.player_id, {
              pts: stat.pts || 0,
              reb: stat.reb || 0,
              ast: stat.ast || 0,
              stl: stat.stl || 0,
              blk: stat.blk || 0,
              tov: stat.tov || 0,
              fantasy_score: fantasyScore,
              game_status: gameStatusMap.get(stat.game_id) || "Scheduled",
            });
          }
        }
      }
    }

    // 5. Combine data and transform to MatchupPlayer
    const players: MatchupPlayer[] = [];

    for (const item of lineupItems) {
      const playerData = playersData.find((p) => p.id === item.player_id);
      if (!playerData) {
        logger.warn(
          `[fetchMatchupLineup] Player ${item.player_id} not found in players data`
        );
        continue;
      }

      const rawStats = playerStatsMap.get(item.player_id);
      let stats: {
        pts: number;
        reb: number;
        ast: number;
        stl?: number;
        blk?: number;
        tov?: number;
        fantasy_score: number;
        game_status: string;
      };
      
      if (rawStats) {
        stats = rawStats;
      } else {
        // No stats available, calculate from lineup item or use 0
        const calculatedScore = item.fantasy_score && item.fantasy_score > 0
          ? item.fantasy_score
          : 0;
        
        stats = {
          pts: 0,
          reb: 0,
          ast: 0,
          fantasy_score: calculatedScore,
          game_status: "Scheduled",
        };
      }

      // Determine status: LIVE if game is in progress, FINAL if completed
      // If we have stats, the game has started (either LIVE or FINAL)
      const hasStats = playerStatsMap.has(item.player_id);
      let status: "LIVE" | "FINAL" = "FINAL";

      if (hasStats) {
        // If we have stats, check game status
        if (
          stats.game_status === "Live" ||
          stats.game_status === "In Progress"
        ) {
          status = "LIVE";
        } else {
          status = "FINAL";
        }
      } else {
        // No stats yet, check if any game is live
        const hasLiveGame = Array.from(gameStatusMap.values()).some(
          (s) => s === "Live" || s === "In Progress"
        );
        status = hasLiveGame ? "LIVE" : "FINAL";
      }

      // Split full_name into first and last name
      const nameParts = (playerData.full_name || "").split(" ");
      const firstName = nameParts[0] || "";
      const lastName = nameParts.slice(1).join(" ") || "";

      // Extract team data (could be nested object or array)
      let team: {
        name?: string;
        code?: string;
        logo_url?: string | null;
      } | null = null;
      if (playerData.team) {
        if (Array.isArray(playerData.team)) {
          team = playerData.team[0] || null;
        } else {
          team = playerData.team as {
            name?: string;
            code?: string;
            logo_url?: string | null;
          };
        }
      }

      players.push({
        id: String(playerData.id),
        name: playerData.full_name || "Unknown Player",
        firstName,
        lastName,
        position: item.position || playerData.position || "C",
        teamLogo: team?.logo_url || "",
        avatar: playerData.headshot_url || "",
        status,
        pts: stats.pts,
        reb: stats.reb,
        ast: stats.ast,
        fpts: stats.fantasy_score,
      });
    }

    logger.info(
      `[fetchMatchupLineup] Successfully fetched ${players.length} players`
    );

    // Calculate total score from all players' fantasy scores
    const calculatedTotalScore = players.reduce((sum, player) => sum + player.fpts, 0);
    
    // Use calculated total if available, otherwise use database value
    const totalScore = calculatedTotalScore > 0 
      ? calculatedTotalScore 
      : (finalLineup.total_score || 0);
    
    logger.info(
      `[fetchMatchupLineup] Total score: calculated=${calculatedTotalScore.toFixed(2)}, database=${finalLineup.total_score || 0}, using=${totalScore.toFixed(2)}`
    );

    return {
      players,
      totalScore,
      lineupId: finalLineup.id,
    };
  } catch (err) {
    logger.error("[fetchMatchupLineup] Unexpected error:", err);
    return null;
  }
}
