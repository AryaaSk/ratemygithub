import type { Metadata } from "next";
import { Geist, Geist_Mono, Press_Start_2P, VT323 } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { Scanlines } from "@/components/arcade/scanlines";
import { ZoralBanner } from "@/components/zoral/banner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const pressStart = Press_Start_2P({
  variable: "--font-press-start",
  weight: "400",
  subsets: ["latin"],
});

const vt323 = VT323({
  variable: "--font-vt323",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "RATE MY GITHUB — arcade-grade developer scoring",
  description:
    "Enter a GitHub username. A three-pass AI pipeline reads your actual code, scores you across 6 rubric dimensions, and drops you on the permanent arcade leaderboard.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${pressStart.variable} ${vt323.variable} h-full antialiased`}
    >
      <body className="relative min-h-full flex flex-col overflow-x-hidden bg-arcade-cream text-arcade-ink dark:bg-arcade-dark dark:text-arcade-cream">
        <Scanlines />
        <ZoralBanner />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
