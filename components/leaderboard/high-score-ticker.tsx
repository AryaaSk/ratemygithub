import { tierForScore } from "@/lib/scoring/rubric";
import { recentRowsData } from "@/lib/data";

export async function HighScoreTicker() {
  const rows = (await recentRowsData()).slice(0, 12);
  const items = [...rows, ...rows]; // duplicated for seamless loop
  return (
    <div
      aria-hidden
      className="w-full overflow-hidden bg-arcade-ink text-arcade-cream border-b-2 border-arcade-ink dark:border-arcade-cream"
    >
      <div className="ticker-scroll flex whitespace-nowrap py-2 will-change-transform">
        {items.map((row, i) => {
          const t = tierForScore(row.score);
          return (
            <span
              key={`${row.login}-${i}`}
              className="inline-flex items-center gap-2 px-6 font-pixel text-[10px] uppercase tracking-widest"
            >
              <span className="text-arcade-green">●</span>
              <span>{row.login}</span>
              <span className="text-arcade-red">{row.score.toFixed(1)}</span>
              <span className="opacity-60">{t.tier}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
