import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Next.js Middleware - Route Protection and Session Refresh
 *
 * Features:
 * 1. Refresh Supabase session on each request
 * 2. Protect routes that require authentication (/profile, /matchups)
 * 3. Redirect unauthenticated users to /login
 * 4. Redirect authenticated users from /login to /lineup
 *
 * Route Protection:
 * - Protected (requires login): /profile, /matchups
 * - Public (no login required): /home, /lineup, /leagues, /team, /player
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // Refresh session (ensure token is valid)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Routes that require authentication (strictly private routes only)
  // /lineup and /leagues are now public (read-only), only write operations require login
  // /home is public (dashboard can be viewed without login)
  // /matchups requires login
  const protectedRoutes = ["/profile", "/matchups"];
  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  );

  // If accessing protected route but not logged in, redirect to login page
  if (isProtectedRoute && !user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // If logged in but accessing login page, redirect to lineup
  if (pathname === "/login" && user) {
    return NextResponse.redirect(new URL("/lineup", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths, except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - Files in public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
