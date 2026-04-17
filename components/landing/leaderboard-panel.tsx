"use client";

import { useState, useMemo } from "react";
import { TabStrip, type TabKey } from "@/components/leaderboard/tab-strip";
import { LeaderboardRow } from "@/components/leaderboard/row";
import { leaderboardRows, recentRows, shameRows } from "@/lib/mock";

function percentileLabel(index: number, total: number) {
  if (index === 0) return "🥇 #1 overall";
  const percentile = 100 - (index / total) * 100;
  return `Top ${percentile.toFixed(1)}%`;
}

export function LeaderboardPanel() {
  const [tab, setTab] = useState<TabKey>("top");
  const all = useMemo(() => leaderboardRows(), []);
  const recent = useMemo(() => recentRows(), []);
  const shame = useMemo(() => shameRows(), []);

  const rows =
    tab === "top"
      ? all
      : tab === "recent"
        ? recent
        : shame;

  return (
    <section className="space-y-4">
      <TabStrip value={tab} onChange={setTab} />
      <div className="pixel-border bg-arcade-cream dark:bg-arcade-dark-soft divide-arcade-ink/10">
        {rows.slice(0, tab === "top" ? 12 : tab === "recent" ? 10 : 6).map((row, i) => (
          <LeaderboardRow
            key={`${tab}-${row.login}`}
            rank={tab === "shame" ? all.length - i : i + 1}
            login={row.login}
            avatar={row.avatar}
            score={row.score}
            tier={row.tier}
            percentileLabel={tab === "top" ? percentileLabel(i, all.length) : undefined}
          />
        ))}
      </div>
      {tab === "top" && (
        <p className="font-pixel text-[9px] uppercase tracking-widest opacity-60 text-center">
          showing top 12 of {all.length}
        </p>
      )}
    </section>
  );
}
