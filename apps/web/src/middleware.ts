import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Next.js Middleware - Route Protection and Session Refresh
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // Defensive check: If environment variables are missing, skip middleware logic
  // This prevents the entire app from returning 404 if Vercel env vars aren't set yet
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return response;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const redirectWithCookies = (url: URL) => {
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach(cookie => redirect.cookies.set(cookie));
    return redirect;
  };

  // Refresh session (ensure token is valid)
  // Wrap in try-catch to prevent crash if Supabase service is unreachable
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { pathname } = request.nextUrl;

    // Protected routes
    const protectedRoutes = ["/profile", "/matchups"];
    const isProtectedRoute = protectedRoutes.some((route) =>
      pathname.startsWith(route)
    );

    if (isProtectedRoute && !user) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return redirectWithCookies(loginUrl);
    }

    if (pathname === "/login" && user) {
      return redirectWithCookies(new URL("/lineup", request.url));
    }
  } catch (e) {
    console.error("Middleware Supabase Auth Error:", e);
  }

  return response;
}

export const config = {
  // Supabase's current SDK needs Node APIs; stable in Next.js 15.5+.
  runtime: 'nodejs',
  matcher: [
    "/((?!api/|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|js|css|json)$).*)",
  ],
};
