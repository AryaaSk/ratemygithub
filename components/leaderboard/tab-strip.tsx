"use client";

import { cn } from "@/lib/utils";

export type TabKey = "top" | "shame";

const TABS: { key: TabKey; label: string }[] = [
  { key: "top", label: "Leaderboard" },
  { key: "shame", label: "Wall of Shame" },
];

export function TabStrip({
  value,
  onChange,
}: {
  value: TabKey;
  onChange: (k: TabKey) => void;
}) {
  return (
    <div
      role="tablist"
      className="flex items-stretch pixel-border-sm bg-arcade-cream dark:bg-arcade-dark-soft overflow-hidden"
    >
      {TABS.map((t) => {
        const active = value === t.key;
        return (
          <button
            key={t.key}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.key)}
            className={cn(
              "flex-1 px-3 py-2 font-pixel text-[10px] uppercase tracking-widest transition-colors border-r border-arcade-ink/30 last:border-r-0",
              active
                ? "bg-arcade-ink text-arcade-cream"
                : "text-arcade-ink/70 hover:bg-arcade-cream-soft hover:text-arcade-ink dark:text-arcade-cream/70 dark:hover:bg-arcade-dark dark:hover:text-arcade-cream",
            )}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
