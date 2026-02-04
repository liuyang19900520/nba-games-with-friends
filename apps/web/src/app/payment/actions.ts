"use server";

import { createClient } from "@/lib/auth/supabase";
import { logger } from "@/config/env";

/**
 * Check if the current user has premium access
 */
export async function checkPremiumStatus(): Promise<boolean> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return false;

    // We check the 'users' table which we updated in the migration
    const { data, error } = await supabase
      .from('users')
      .select('has_premium')
      .eq('id', user.id)
      .single();

    if (error) {
      // If profile doesn't exist yet, they definitely don't have premium
      if (error.code !== 'PGRST116') {
        logger.error("[checkPremiumStatus] Error:", error);
      }
      return false;
    }

    return !!data?.has_premium;
  } catch (err) {
    logger.error("[checkPremiumStatus] Unexpected error:", err);
    return false;
  }
}
