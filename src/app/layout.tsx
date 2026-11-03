import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin", "latin-ext"] });

export const metadata: Metadata = {
  // Share pictures need a full web address; this is the start of it.
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://bookbell.vercel.app"),
  title: { default: "Bookbell", template: "%s · Bookbell" },
  description: "Online booking with a friendly AI helper, for small shops.",
  applicationName: "Bookbell",
  openGraph: { siteName: "Bookbell", type: "website" },
  twitter: { card: "summary_large_image" },
  // Opened from the home screen, the iPhone status bar stays light like the app.
  appleWebApp: { title: "Bookbell", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} h-full`}>
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
