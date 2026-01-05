"use server";

import { createClient } from "@/lib/auth/supabase";
import { revalidatePath } from "next/cache";
import { logger } from "@/config/env";

/**
 * Server Actions for Lineup operations
 */

interface LineupPlayer {
  playerId: string;
  position: string;
}

interface SubmitLineupResult {
  success: boolean;
  error?: string;
  lineupId?: number;
}

/**
 * Submit lineup for today
 * Creates user_daily_lineups record and lineup_items records
 */
export async function submitLineup(
  players: LineupPlayer[]
): Promise<SubmitLineupResult> {
  try {
    const supabase = await createClient();

    // 1. Check if user is authenticated
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      logger.warn("[submitLineup] User not authenticated");
      return {
        success: false,
        error: "Please sign in to submit your lineup",
      };
    }

    // 2. Validate players
    if (players.length !== 5) {
      return {
        success: false,
        error: "You must select exactly 5 players",
      };
    }

    // 3. Get today's date in UTC
    const today = new Date().toISOString().split("T")[0];

    // 4. Check if lineup already exists for today
    const { data: existingLineup, error: checkError } = await supabase
      .from("user_daily_lineups")
      .select("id, status")
      .eq("user_id", user.id)
      .eq("game_date", today)
      .single();

    if (checkError && checkError.code !== "PGRST116") {
      // PGRST116 = no rows found, which is expected
      logger.error("[submitLineup] Error checking existing lineup:", checkError);
      return {
        success: false,
        error: "Failed to check existing lineup",
      };
    }

    if (existingLineup) {
      if (existingLineup.status === "submitted") {
        return {
          success: false,
          error: "You have already submitted your lineup for today",
        };
      }
      if (existingLineup.status === "settled") {
        return {
          success: false,
          error: "Today's lineup has already been settled",
        };
      }
    }

    // 5. Ensure user exists in users table (required by foreign key constraint)
    // Check if user exists first, if not, we'll handle it gracefully
    const { data: existingUser, error: userCheckError } = await supabase
      .from("users")
      .select("id")
      .eq("id", user.id)
      .single();

    if (userCheckError && userCheckError.code !== "PGRST116") {
      // PGRST116 = no rows found (user doesn't exist)
      logger.error("[submitLineup] Error checking user:", userCheckError);
      return {
        success: false,
        error: "User account not found. Please contact support.",
      };
    }

    // If user doesn't exist, we can't create it due to RLS policy
    // This should be handled by a database trigger or the user should be created during signup
    if (!existingUser) {
      logger.warn(`[submitLineup] User ${user.id} not found in users table. RLS policy prevents creation.`);
      return {
        success: false,
        error: "Your account is not fully set up. Please sign out and sign in again, or contact support.",
      };
    }

    let lineupId: number;

    // 6. Create or update user_daily_lineups record
    if (existingLineup) {
      // Update existing draft lineup to submitted
      const { error: updateError } = await supabase
        .from("user_daily_lineups")
        .update({
          status: "submitted",
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingLineup.id);

      if (updateError) {
        logger.error("[submitLineup] Error updating lineup:", updateError);
        return {
          success: false,
          error: "Failed to update lineup",
        };
      }

      lineupId = existingLineup.id;

      // Delete existing lineup items before inserting new ones
      const { error: deleteError } = await supabase
        .from("lineup_items")
        .delete()
        .eq("lineup_id", lineupId);

      if (deleteError) {
        logger.error("[submitLineup] Error deleting old lineup items:", deleteError);
      }
    } else {
      // Create new lineup record
      const { data: newLineup, error: insertError } = await supabase
        .from("user_daily_lineups")
        .insert({
          user_id: user.id,
          game_date: today,
          status: "submitted",
          total_score: 0,
        })
        .select("id")
        .single();

      if (insertError || !newLineup) {
        logger.error("[submitLineup] Error creating lineup:", insertError);
        return {
          success: false,
          error: insertError?.message || "Failed to create lineup",
        };
      }

      lineupId = newLineup.id;
    }

    // 7. Insert lineup items
    const lineupItems = players.map((player) => ({
      lineup_id: lineupId,
      player_id: parseInt(player.playerId, 10),
      position: player.position,
      fantasy_score: 0,
    }));

    const { error: itemsError } = await supabase
      .from("lineup_items")
      .insert(lineupItems);

    if (itemsError) {
      logger.error("[submitLineup] Error inserting lineup items:", itemsError);
      return {
        success: false,
        error: "Failed to save lineup players",
      };
    }

    logger.info(`[submitLineup] Successfully submitted lineup ${lineupId} for user ${user.id}`);

    // 7. Revalidate lineup page to reflect changes
    revalidatePath("/lineup");

    return {
      success: true,
      lineupId,
    };
  } catch (err) {
    logger.error("[submitLineup] Unexpected error:", err);
    return {
      success: false,
      error: "An unexpected error occurred",
    };
  }
}

/**
 * Get today's lineup for the current user
 */
export async function getTodayLineup(): Promise<{
  lineup: {
    id: number;
    status: string;
    gameDate: string;
    totalScore: number;
  } | null;
  items: Array<{
    playerId: string;
    position: string;
    fantasyScore: number;
  }>;
  error?: string;
}> {
  try {
    const supabase = await createClient();

    // 1. Check if user is authenticated
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { lineup: null, items: [] };
    }

    // 2. Get today's date
    const today = new Date().toISOString().split("T")[0];

    // 3. Fetch lineup for today
    const { data: lineup, error: lineupError } = await supabase
      .from("user_daily_lineups")
      .select("id, status, game_date, total_score")
      .eq("user_id", user.id)
      .eq("game_date", today)
      .single();

    if (lineupError && lineupError.code !== "PGRST116") {
      logger.error("[getTodayLineup] Error fetching lineup:", lineupError);
      return { lineup: null, items: [], error: "Failed to fetch lineup" };
    }

    if (!lineup) {
      return { lineup: null, items: [] };
    }

    // 4. Fetch lineup items
    const { data: items, error: itemsError } = await supabase
      .from("lineup_items")
      .select("player_id, position, fantasy_score")
      .eq("lineup_id", lineup.id);

    if (itemsError) {
      logger.error("[getTodayLineup] Error fetching lineup items:", itemsError);
      return {
        lineup: {
          id: lineup.id,
          status: lineup.status,
          gameDate: lineup.game_date,
          totalScore: lineup.total_score,
        },
        items: [],
        error: "Failed to fetch lineup items",
      };
    }

    return {
      lineup: {
        id: lineup.id,
        status: lineup.status,
        gameDate: lineup.game_date,
        totalScore: lineup.total_score,
      },
      items: (items || []).map((item) => ({
        playerId: String(item.player_id),
        position: item.position,
        fantasyScore: item.fantasy_score,
      })),
    };
  } catch (err) {
    logger.error("[getTodayLineup] Unexpected error:", err);
    return { lineup: null, items: [], error: "An unexpected error occurred" };
  }
}
