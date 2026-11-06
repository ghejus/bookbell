import { type NextRequest } from "next/server";
import { LANG_COOKIE, langFor, splitLangPath } from "@/lib/i18n/config";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  const full = request.nextUrl.pathname;
  // Addresses stay the same in every language (printed QR codes keep working).
  // The language comes from the address if it has one (/ro/...), else the
  // visitor's EN · RO choice, else their phone's language.
  const { lang: inPath, rest } = splitLangPath(full);
  const lang = inPath ?? langFor(request.cookies.get(LANG_COOKIE)?.value, request.headers.get("accept-language"));
  const rewriteTo = inPath || full.startsWith("/api/") ? null : `/${lang}${full === "/" ? "" : full}`;
  return updateSession(request, { lang, path: rest, rewriteTo });
}

export const config = {
  matcher: [
    // Everything except Next.js files, images, videos, icons, share pictures and search-engine files.
    "/((?!_next/static|_next/image|favicon.ico|icon/|apple-icon|manifest.webmanifest|robots.txt|sitemap.xml|.*opengraph-image|.*\.(?:svg|png|jpg|jpeg|gif|webp|mp4)$).*)",
  ],
};
