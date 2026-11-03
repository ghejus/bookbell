import type { MetadataRoute } from "next";
import { brand } from "@/lib/brand";

// Lets people add Bookbell to their phone's home screen, so it opens like an app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Bookbell",
    short_name: "Bookbell",
    description: "Online booking with a friendly AI helper, for small shops.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: brand.ground,
    theme_color: "#ffffff",
    icons: [
      { src: "/icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
