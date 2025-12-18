import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase client singleton
 *
 * Uses environment variables:
 * - VITE_SUPABASE_URL: Your Supabase project URL
 * - VITE_SUPABASE_ANON_KEY: Your Supabase anonymous key
 *
 * These should be set in your .env file for development
 * and configured in your deployment environment for production.
 */

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  const errorMsg =
    "Missing Supabase environment variables. Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in your .env file.";
  console.error("[supabase] Configuration error:", errorMsg);
  throw new Error(errorMsg);
}

/**
 * Create and export the Supabase client as a singleton
 * This ensures we only create one client instance throughout the app
 */
export const supabase: SupabaseClient = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  }
);
