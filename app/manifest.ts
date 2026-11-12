import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SubtitleAI — Video Transcript & Subtitle Generator",
    short_name: "SubtitleAI",
    description:
      "Free AI transcripts and subtitles for movies, videos and audio of any length. English, Sinhala, Tamil, Spanish and 30+ languages.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#f0fdf4",
    theme_color: "#16a34a",
    categories: ["productivity", "utilities", "entertainment"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
