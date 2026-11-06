import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { LANGS } from "@/lib/i18n/config";
import { LangProvider } from "@/lib/i18n/client";
import { getT, pageLang } from "@/lib/i18n/server";
import "../globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin", "latin-ext"] });

const baseMetadata: Metadata = {
  // Share pictures need a full web address; this is the start of it.
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://bookbell.vercel.app"),
  title: { default: "Bookbell", template: "%s · Bookbell" },
  description: "Online booking with a friendly AI helper, for small shops.",
  applicationName: "Bookbell",
  openGraph: { siteName: "Bookbell", type: "website" },
  twitter: { card: "summary_large_image" },
  // Opened from the home screen, the app runs full screen and the iPhone status bar
  // sits on top of the dark page (globals.css keeps content out from under it).
  appleWebApp: { capable: true, title: "Bookbell", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#161826",
  colorScheme: "dark",
  // Lets the page reach the edges around the iPhone notch and home bar.
  viewportFit: "cover",
};

// Every page exists once per language (the proxy picks which one a visitor gets).
export function generateStaticParams() {
  return LANGS.map((l) => ({ lang: l }));
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { ...baseMetadata, description: t.home.metaDescription };
}

export default async function RootLayout({ children }: LayoutProps<"/[lang]">) {
  const lang = await pageLang();
  return (
    <html lang={lang} className={`${inter.variable} h-full`}>
      <body className="flex min-h-full flex-col font-sans">
        <LangProvider lang={lang}>{children}</LangProvider>
      </body>
    </html>
  );
}
