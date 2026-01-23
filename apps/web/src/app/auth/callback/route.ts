import { createClient } from "@/lib/auth/supabase";
import { NextResponse, type NextRequest } from "next/server";

/**
 * OAuth Callback Route Handler
 *
 * Handles Google OAuth callback, exchanges code for session, then redirects to target page
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") || "/lineup";

  if (code) {
    const supabase = await createClient();

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Successfully exchanged code, redirect to target page
      return NextResponse.redirect(new URL(next, requestUrl.origin));
    }
  }

  // If code doesn't exist or exchange failed, redirect to login page and show error
  return NextResponse.redirect(
    new URL(`/login?error=OAuth authentication failed`, requestUrl.origin)
  );
}
