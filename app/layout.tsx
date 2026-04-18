import type { Metadata } from "next";
import { Geist, Geist_Mono, Press_Start_2P, VT323 } from "next/font/google";
import "./globals.css";
import { Scanlines } from "@/components/arcade/scanlines";
import { AliaskitBanner } from "@/components/aliaskit/banner";

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
    "Enter a GitHub username. Our sandboxed Claude agent scrapes the profile, scores it across 8 categories, and drops you on a permanent arcade leaderboard.",
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
      <body className="relative min-h-full flex flex-col bg-arcade-cream text-arcade-ink dark:bg-arcade-dark dark:text-arcade-cream">
        <Scanlines />
        <AliaskitBanner />
        {children}
      </body>
    </html>
  );
}
