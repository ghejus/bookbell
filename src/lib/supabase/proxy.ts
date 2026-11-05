import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasSupabaseEnv } from "@/lib/env";
import { safeNextPath } from "@/lib/validation";

// Runs before every page. Keeps the login fresh and sends logged-out
// visitors away from the dashboard.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  if (!hasSupabaseEnv) return response;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          // "Don't cache this" headers, so one person's login is never served to another.
          Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
        },
      },
    },
  );

  // Keep this call right after createServerClient. It checks the login token
  // and refreshes it if needed.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims);

  const path = request.nextUrl.pathname;
  if (!signedIn && path.startsWith("/dashboard")) return redirectKeepingCookies(request, response, "/login");
  // Customers come back to My bookings after logging in.
  if (!signedIn && (path === "/my" || path.startsWith("/my/"))) {
    return redirectKeepingCookies(request, response, "/login", { as: "customer", next: path });
  }
  if (signedIn && (path === "/login" || path === "/signup")) {
    return redirectKeepingCookies(request, response, safeNextPath(request.nextUrl.searchParams.get("next"), "/start"));
  }

  return response;
}

// A redirect that still carries any refreshed login cookies and "don't cache" headers.
function redirectKeepingCookies(request: NextRequest, response: NextResponse, target: string, query: Record<string, string> = {}) {
  const url = new URL(target, request.nextUrl.origin);
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  const redirect = NextResponse.redirect(url);
  response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  for (const header of ["cache-control", "expires", "pragma"]) {
    const value = response.headers.get(header);
    if (value) redirect.headers.set(header, value);
  }
  return redirect;
}
