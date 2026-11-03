import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Everything except Next.js files, images, icons, share pictures and search-engine files.
    "/((?!_next/static|_next/image|favicon.ico|icon/|apple-icon|manifest.webmanifest|robots.txt|sitemap.xml|.*opengraph-image|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
