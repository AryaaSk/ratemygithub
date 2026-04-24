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

      <footer className="px-4 sm:px-8 py-5 border-t-2 border-arcade-ink/15 dark:border-arcade-cream/15 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="font-pixel text-[9px] uppercase tracking-widest opacity-60 flex flex-wrap items-center gap-x-4 gap-y-1">
          <span>
            Built using{" "}
            <a
              href="https://zoral.ai"
              target="_blank"
              rel="noreferrer"
              className="text-arcade-red hover:underline underline-offset-2"
            >
              Zoral
            </a>
          </span>
          <span>public data only</span>
        </div>
        <CreditBlock />
      </footer>
    </div>
  );
}

function CreditBlock() {
  return (
    <div className="self-start sm:self-auto bg-arcade-ink text-arcade-cream pixel-border-sm px-3 py-2 font-mono text-[11px] leading-tight">
      <p>
        i work for{" "}
        <a
          href="https://x.com/aryaa_sk"
          target="_blank"
          rel="noreferrer"
          className="text-arcade-green hover:underline underline-offset-2"
        >
          Aryaa SK
        </a>
      </p>
      <div className="mt-1 flex items-center gap-2 text-arcade-cream/70">
        <a
          href="https://www.linkedin.com/in/aryaa-sk-1b343992/"
          target="_blank"
          rel="noreferrer"
          aria-label="Aryaa SK on LinkedIn"
          className="inline-flex items-center justify-center w-4 h-4 hover:text-arcade-green transition-colors"
        >
          <svg viewBox="0 0 24 24" aria-hidden className="w-full h-full fill-current">
            <path d="M4.98 3.5C4.98 4.88 3.87 6 2.5 6S0 4.88 0 3.5 1.12 1 2.5 1s2.48 1.12 2.48 2.5zM.22 8.25h4.56V23H.22V8.25zM8.12 8.25h4.37v2.02h.06c.61-1.15 2.1-2.36 4.32-2.36 4.62 0 5.47 3.04 5.47 7v8.09H17.8v-7.18c0-1.71-.03-3.91-2.38-3.91-2.38 0-2.75 1.86-2.75 3.78V23H8.12V8.25z" />
          </svg>
        </a>
        <a
          href="https://x.com/aryaa_sk"
          target="_blank"
          rel="noreferrer"
          aria-label="Aryaa SK on X"
          className="inline-flex items-center justify-center w-4 h-4 hover:text-arcade-green transition-colors"
        >
          <svg viewBox="0 0 24 24" aria-hidden className="w-full h-full fill-current">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25h6.828l4.713 6.231 5.45-6.231zM17.08 19.77h1.833L7.084 4.126H5.117L17.08 19.77z" />
          </svg>
        </a>
        <a
          href="https://github.com/aryaask"
          target="_blank"
          rel="noreferrer"
          aria-label="Aryaa SK on GitHub"
          className="inline-flex items-center justify-center w-4 h-4 hover:text-arcade-green transition-colors"
        >
          <svg viewBox="0 0 24 24" aria-hidden className="w-full h-full fill-current">
            <path d="M12 .5C5.73.5.5 5.73.5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2c-3.2.7-3.87-1.36-3.87-1.36-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.7.08-.7 1.17.08 1.78 1.2 1.78 1.2 1.04 1.78 2.72 1.27 3.38.97.1-.76.4-1.27.74-1.56-2.55-.3-5.24-1.28-5.24-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.47.11-3.06 0 0 .97-.31 3.19 1.19a11 11 0 0 1 5.8 0c2.21-1.5 3.18-1.19 3.18-1.19.63 1.59.23 2.77.12 3.06.74.81 1.19 1.84 1.19 3.1 0 4.44-2.7 5.4-5.26 5.69.41.35.77 1.04.77 2.1v3.12c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5z" />
          </svg>
        </a>
      </div>
    </div>
  );
}
