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

// Mobile-only soft cap: the leaderboard easily runs to 800+ rows, and the
// vibes panel sits below it on small viewports — so users would have to
// scroll past every row to see it. On desktop the vibes panel lives in a
// sticky sidebar, so the cap is lifted via responsive classes (rows beyond
// the cap are `hidden lg:flex` until the user expands).
const MOBILE_PAGE_SIZE = 100;

export function LeaderboardPanel({ initialTop, initialShame }: Props) {
  const [tab, setTab] = useState<TabKey>("top");
  const [top, setTop] = useState(initialTop);
  const [shame, setShame] = useState(initialShame);
  const [mobileShowAll, setMobileShowAll] = useState(false);

  const rowsForTab = useMemo(() => {
    if (tab === "top") return top;
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
  const overCap =
    tab === "top" && !mobileShowAll && rowsForTab.length > MOBILE_PAGE_SIZE;

  return (
    <section className="space-y-3">
      <TabStrip value={tab} onChange={setTab} />

      <div className="pixel-border bg-arcade-cream dark:bg-arcade-dark-soft">
        {empty ? (
          <p className="p-6 text-center font-pixel text-[10px] uppercase tracking-widest opacity-50">
            {tab === "shame" ? "No spectators yet." : "No ratings yet. Be first."}
          </p>
        ) : (
          rowsForTab.map((row, i) => {
            const beyondMobileCap =
              tab === "top" &&
              !mobileShowAll &&
              i >= MOBILE_PAGE_SIZE;
            return (
              <div
                key={`${tab}-${row.login}`}
                className={beyondMobileCap ? "hidden lg:block" : ""}
              >
                <LeaderboardRow
                  rank={tab === "shame" ? top.length - i : i + 1}
                  login={row.login}
                  avatar={
                    row.avatarUrl ?? `https://github.com/${row.login}.png`
                  }
                  score={row.score}
                  tier={row.tier}
                />
              </div>
            );
          })
        )}
        {overCap && (
          <button
            type="button"
            onClick={() => setMobileShowAll(true)}
            className="lg:hidden w-full px-4 py-3 font-pixel text-[10px] uppercase tracking-widest text-arcade-red hover:bg-arcade-cream-soft dark:hover:bg-arcade-dark transition-colors border-t-2 border-arcade-ink/15 dark:border-arcade-cream/15"
          >
            ▾ show all {rowsForTab.length}
          </button>
        )}
      </div>
      {tab === "top" && top.length > 0 && (
        <p className="font-pixel text-[9px] uppercase tracking-widest opacity-50 text-center">
          {overCap ? (
            <>
              <span className="lg:hidden">
                showing 1–{MOBILE_PAGE_SIZE} of {top.length}
              </span>
              <span className="hidden lg:inline">showing all {top.length}</span>
            </>
          ) : (
            <>showing all {top.length}</>
          )}
        </p>
      )}
    </section>
  );
}
