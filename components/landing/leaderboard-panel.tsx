"use client";

import { useEffect, useMemo, useState } from "react";
import { TabStrip, type TabKey } from "@/components/leaderboard/tab-strip";
import { LeaderboardRow } from "@/components/leaderboard/row";
import type { LeaderboardRow as Row } from "@/lib/data";
import { supabaseBrowser } from "@/lib/supabase-browser";

type Props = {
  initialTop: Row[];
  initialShame: Row[];
};

export function LeaderboardPanel({ initialTop, initialShame }: Props) {
  const [tab, setTab] = useState<TabKey>("top");
  const [top, setTop] = useState(initialTop);
  const [shame, setShame] = useState(initialShame);

  const rowsForTab = useMemo(() => {
    if (tab === "top") return top.slice(0, 12);
    return shame.slice(0, 6);
  }, [tab, top, shame]);

  useEffect(() => {
    const sb = supabaseBrowser();
    if (!sb) return;
    const channel = sb
      .channel("ratings-feed")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "ratings" },
        async () => {
          const [t, s] = await Promise.all([
            fetch("/api/leaderboard?kind=top").then((r) => r.json()),
            fetch("/api/leaderboard?kind=shame").then((r) => r.json()),
          ]);
          if (Array.isArray(t.rows)) setTop(t.rows);
          if (Array.isArray(s.rows)) setShame(s.rows);
        },
      )
      .subscribe();
    return () => {
      sb.removeChannel(channel);
    };
  }, []);

  const empty = rowsForTab.length === 0;

  return (
    <section className="space-y-3">
      <TabStrip value={tab} onChange={setTab} />

      <div className="pixel-border bg-arcade-cream dark:bg-arcade-dark-soft">
        {empty ? (
          <p className="p-6 text-center font-pixel text-[10px] uppercase tracking-widest opacity-50">
            {tab === "shame" ? "No spectators yet." : "No ratings yet. Be first."}
          </p>
        ) : (
          rowsForTab.map((row, i) => (
            <LeaderboardRow
              key={`${tab}-${row.login}`}
              rank={tab === "shame" ? top.length - i : i + 1}
              login={row.login}
              avatar={row.avatarUrl ?? `https://github.com/${row.login}.png`}
              score={row.score}
              tier={row.tier}
            />
          ))
        )}
      </div>
      {tab === "top" && top.length > 12 && (
        <p className="font-pixel text-[9px] uppercase tracking-widest opacity-50 text-center">
          showing top 12 of {top.length}
        </p>
      )}
    </section>
  );
}
