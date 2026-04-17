import Link from "next/link";
import { HighScoreTicker } from "@/components/leaderboard/high-score-ticker";
import { HeroCard } from "@/components/landing/hero-card";
import { LeaderboardPanel } from "@/components/landing/leaderboard-panel";

export default function Home() {
  return (
    <div className="flex-1 flex flex-col">
      <HighScoreTicker />

      <header className="px-6 sm:px-10 pt-8 pb-4 flex items-center justify-between gap-4">
        <Link
          href="/"
          className="font-pixel text-lg sm:text-xl tracking-tight leading-none"
        >
          RATE<br className="sm:hidden" />
          <span className="sm:ml-2">MY GITHUB</span>
        </Link>
        <nav className="flex items-center gap-5 font-pixel text-[10px] uppercase">
          <Link href="/style" className="opacity-70 hover:opacity-100">
            Style
          </Link>
          <a
            href="https://github.com/"
            target="_blank"
            rel="noreferrer"
            className="opacity-70 hover:opacity-100"
          >
            About
          </a>
        </nav>
      </header>

      <main className="flex-1 mx-auto w-full max-w-5xl px-6 sm:px-10 pb-20 space-y-12">
        <HeroCard />
        <LeaderboardPanel />
      </main>

      <footer className="px-6 sm:px-10 py-6 border-t-2 border-arcade-ink/20 dark:border-arcade-cream/20 font-pixel text-[9px] uppercase tracking-widest opacity-70 flex flex-wrap items-center justify-between gap-3">
        <span>v0.1 · arcade edition</span>
        <span>public data only · no login required</span>
      </footer>
    </div>
  );
}
