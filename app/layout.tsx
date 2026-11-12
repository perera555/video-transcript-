import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Geist_Mono } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SubtitleAI — Free Video Transcript & Subtitle Generator",
  description:
    "Free AI transcripts and subtitles for movies, videos and audio of any length (2–4 hour movies welcome). English, Sinhala, Tamil, Spanish and 30+ languages. Download SRT, VTT, TXT. Extract audio. Installable on any device.",
  applicationName: "SubtitleAI",
  appleWebApp: { capable: true, title: "SubtitleAI", statusBarStyle: "default" },
  icons: { icon: "/icons/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: "#16a34a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${jakarta.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="relative min-h-full flex flex-col">{children}</body>
    </html>
  );
}
