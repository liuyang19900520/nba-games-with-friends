"use server";

import { createClient } from "@/lib/auth/supabase";
import { logger } from "@/config/env";

/**
 * Get the number of AI credits remaining for the current user.
 * Returns 0 if not authenticated or no credits.
 */
export async function getCreditsRemaining(): Promise<number> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return 0;

    const { data, error } = await supabase
      .from('users')
      .select('ai_credits_remaining')
      .eq('id', user.id)
      .single();

    if (error) {
      if (error.code !== 'PGRST116') {
        logger.error("[getCreditsRemaining] Error:", error);
      }
      return 0;
    }

    return data?.ai_credits_remaining ?? 0;
  } catch (err) {
    logger.error("[getCreditsRemaining] Unexpected error:", err);
    return 0;
  }
}

/**
 * @deprecated Use getCreditsRemaining() instead.
 */
export async function checkPremiumStatus(): Promise<boolean> {
  const credits = await getCreditsRemaining();
  return credits > 0;
}
