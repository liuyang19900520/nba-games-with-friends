"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Client-side Supabase Client
 *
 * Used for Supabase operations in Client Components (e.g., real-time subscriptions, client-side auth).
 * Uses environment variables prefixed with process.env.NEXT_PUBLIC_.
 *
 * Note:
 * - Only use in Client Components.
 * - Requires persistSession and autoRefreshToken (browser environment).
 * - Uses lazy initialization to avoid errors during server-side execution.
 */

let supabaseInstance: SupabaseClient | null = null;

/**
 * Get the Supabase client singleton (Lazy Initialization)
 * Ensures only one client instance is created for the entire application.
 *
 * Initialized only when running on the client to avoid server-side rendering errors.
 */
function getSupabaseClient(): SupabaseClient {
  // If already initialized, return directly
  if (supabaseInstance) {
    return supabaseInstance;
  }

  // Check if running in a client environment
  if (typeof window === "undefined") {
    throw new Error(
      "Supabase client can only be used in client components. " +
        "For server-side operations, use createServerClient from @/lib/db/supabase-server"
    );
  }

  // Initialize in client environment
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    const errorMsg =
      "Missing Supabase environment variables. Please ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set in your .env.local file.";
    console.error("[supabase] Configuration error:", errorMsg);
    throw new Error(errorMsg);
  }

  supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true, // Client needs to persist session
      autoRefreshToken: true, // Client needs to auto-refresh token
    },
  });

  return supabaseInstance;
}

/**
 * Export Supabase Client
 * Uses a getter function to implement lazy initialization.
 */
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop, _receiver) {
    const client = getSupabaseClient();
    const key = prop as keyof SupabaseClient;
    const value = client[key];
    // If it is a function, bind the 'this' context
    if (typeof value === "function") {
      return value.bind(client);
    }
    return value;
  },
});
