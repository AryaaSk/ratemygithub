import Link from "next/link";
import { Avatar } from "@/components/arcade/avatar";
import { TierMedal } from "@/components/arcade/tier-medal";
import type { DailyVibes } from "@/lib/data";
import type { Tier } from "@/lib/scoring/rubric";
import { cn } from "@/lib/utils";

type Props = { data: DailyVibes };

const FLAVOR_DOT: Record<string, string> = {
  red: "bg-arcade-red",
  blue: "bg-arcade-blue",
  green: "bg-arcade-green-deep",
  yellow: "bg-arcade-yellow",
  purple: "bg-arcade-purple",
};

export function DailyVibesPanel({ data }: Props) {
  const { stats, roasts, climbers } = data;
  if (stats.nRatings === 0 && roasts.length === 0) return null;

  return (
    <section className="pixel-border bg-arcade-cream-soft dark:bg-arcade-dark-soft">
      <header className="px-4 sm:px-5 py-3 border-b-2 border-arcade-ink/15 dark:border-arcade-cream/15 flex items-baseline justify-between gap-3">
        <h2 className="font-pixel text-[11px] sm:text-xs tracking-tight">
          TODAY&apos;S VIBES
        </h2>
        <span className="font-pixel text-[9px] uppercase tracking-widest opacity-50">
          last {stats.hours}h
        </span>
      </header>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 border-b-2 border-arcade-ink/15 dark:border-arcade-cream/15">
        <StatTile
          label="rated"
          value={stats.nUsers.toLocaleString()}
          accent="text-arcade-ink dark:text-arcade-cream"
        />
        <StatTile
          label="median"
          value={stats.medianScore.toFixed(1)}
          suffix="/100"
          accent="text-arcade-blue"
        />
        <StatTile
          label="S tier"
          value={String(stats.sCount)}
          accent="text-arcade-green-deep"
        />
        <StatTile
          label="F tier"
          value={String(stats.fCount)}
          accent="text-arcade-red"
        />
      </div>

      {/* Roasts */}
      {roasts.length > 0 && (
        <div className="px-4 sm:px-5 py-4 border-b-2 border-arcade-ink/15 dark:border-arcade-cream/15">
          <SectionTitle accent="🔥" text="Roasts of the day" />
          <ul className="mt-3 space-y-3">
            {roasts.map((r, i) => (
              <li key={`${r.login}-${i}`}>
                <Link
                  href={`/u/${r.login}`}
                  className={cn(
                    "block group pixel-border-sm",
                    "bg-arcade-cream dark:bg-arcade-dark",
                    "px-3 py-3 hover:translate-x-[1px] hover:-translate-y-[1px] transition-transform",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span
                      aria-hidden
                      className={cn(
                        "shrink-0 mt-1 w-2 h-2",
                        FLAVOR_DOT[r.flavor] ?? "bg-arcade-ink",
                      )}
                    />
                    <div className="min-w-0 flex-1 space-y-2">
                      <p className="font-mono text-[12px] sm:text-[13px] leading-snug text-arcade-ink dark:text-arcade-cream">
                        &ldquo;{r.body}&rdquo;
                      </p>
                      <div className="flex items-center gap-2 min-w-0">
                        <Avatar
                          src={
                            r.avatarUrl ?? `https://github.com/${r.login}.png`
                          }
                          size={20}
                        />
                        <span className="font-pixel text-[10px] truncate">
                          {r.displayLogin}
                        </span>
                        <span className="font-pixel text-[9px] uppercase tracking-widest opacity-60 shrink-0">
                          · {r.tier} tier · {r.score.toFixed(1)}
                        </span>
                      </div>
                    </div>
                    <TierMedal
                      tier={r.tier as Tier}
                      size={20}
                      className="shrink-0 hidden sm:inline-flex"
                    />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Climbers */}
      {climbers.length > 0 && (
        <div className="px-4 sm:px-5 py-4">
          <SectionTitle accent="📈" text="Climbing the ladder" />
          <ul className="mt-3 divide-y divide-arcade-ink/10 dark:divide-arcade-cream/10">
            {climbers.map((c) => (
              <li key={c.login}>
                <Link
                  href={`/u/${c.login}`}
                  className="flex items-center gap-3 py-2 hover:bg-arcade-cream dark:hover:bg-arcade-dark transition-colors -mx-2 px-2"
                >
                  <Avatar
                    src={c.avatarUrl ?? `https://github.com/${c.login}.png`}
                    size={28}
                  />
                  <span className="font-pixel text-[11px] truncate flex-1">
                    {c.displayLogin}
                  </span>
                  <span className="font-pixel text-[10px] tabular-nums opacity-60">
                    {c.oldScore.toFixed(1)}
                  </span>
                  <span className="font-pixel text-[10px] opacity-50">→</span>
                  <span className="font-score text-base tabular-nums">
                    {c.newScore.toFixed(1)}
                  </span>
                  <span className="font-pixel text-[10px] uppercase tracking-widest text-arcade-green-deep tabular-nums">
                    +{c.delta.toFixed(1)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function StatTile({
  label,
  value,
  suffix,
  accent,
}: {
  label: string;
  value: string;
  suffix?: string;
  accent: string;
}) {
  return (
    <div
      className={cn(
        "px-4 py-3 border-arcade-ink/15 dark:border-arcade-cream/15",
        // Mobile (2 cols): right border on odd tiles; bottom border on top row.
        "[&:nth-child(odd)]:border-r-2",
        "[&:nth-child(-n+2)]:border-b-2",
        // Desktop (4 cols): right border on every tile except the last; no row dividers.
        "sm:border-r-2 sm:last:border-r-0",
        "sm:[&:nth-child(-n+2)]:border-b-0",
      )}
    >
      <div className="font-pixel text-[9px] uppercase tracking-widest opacity-60">
        {label}
      </div>
      <div className="mt-1 flex items-baseline gap-1">
        <span
          className={cn("font-score text-2xl sm:text-3xl tabular-nums", accent)}
        >
          {value}
        </span>
        {suffix && (
          <span className="font-pixel text-[9px] opacity-50">{suffix}</span>
        )}
      </div>
    </div>
  );
}

function SectionTitle({ accent, text }: { accent: string; text: string }) {
  return (
    <h3 className="font-pixel text-[10px] sm:text-[11px] uppercase tracking-widest flex items-center gap-2">
      <span aria-hidden>{accent}</span>
      {text}
    </h3>
  );
}
