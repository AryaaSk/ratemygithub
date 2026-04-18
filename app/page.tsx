import Link from "next/link";
import { HeroCard } from "@/components/landing/hero-card";
import { LeaderboardPanel } from "@/components/landing/leaderboard-panel";
import { shameRowsData, topRows } from "@/lib/data";

export const revalidate = 15;

export default async function Home() {
  const [top, shame] = await Promise.all([topRows(), shameRowsData()]);

  return (
    <div className="flex-1 flex flex-col">
      <main className="flex-1 mx-auto w-full max-w-3xl px-4 sm:px-8 pt-6 sm:pt-10 pb-16 space-y-8 sm:space-y-10">
        <HeroCard />
        <LeaderboardPanel initialTop={top} initialShame={shame} />
      </main>

      <footer className="px-4 sm:px-8 py-5 border-t-2 border-arcade-ink/15 dark:border-arcade-cream/15 font-pixel text-[9px] uppercase tracking-widest opacity-60 flex flex-wrap items-center justify-between gap-2">
        <span>
          Built using{" "}
          <a
            href="https://aliaskit.com"
            target="_blank"
            rel="noreferrer"
            className="text-arcade-red hover:underline underline-offset-2"
          >
            AliasKit
          </a>
        </span>
        <span>public data only</span>
      </footer>
    </div>
  );
}
