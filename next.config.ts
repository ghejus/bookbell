import type { NextConfig } from "next";

// Safety notes sent with every page.
const securityHeaders = [
  // No other website may show these pages inside a frame (stops "hidden button" tricks).
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
  // Browsers must trust the file type we send, not guess it.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Other sites only learn which site a visitor came from, never the full page address.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // The app never needs the camera, microphone or location.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
