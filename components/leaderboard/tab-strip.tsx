"use client";

import { cn } from "@/lib/utils";

export type TabKey = "top" | "recent" | "shame";

const TABS: { key: TabKey; label: string; sub: string }[] = [
  { key: "top", label: "GLOBAL TOP 100", sub: "All-time" },
  { key: "recent", label: "RECENTLY RATED", sub: "Last 20" },
  { key: "shame", label: "HALL OF SHAME", sub: "Bottom 6" },
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
      className="flex items-stretch gap-0 pixel-border bg-arcade-cream dark:bg-arcade-dark-soft overflow-hidden"
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
              "flex-1 px-4 py-3 text-left transition-colors border-r-2 last:border-r-0 border-arcade-ink dark:border-arcade-cream",
              active
                ? "bg-arcade-red text-arcade-cream"
                : "hover:bg-arcade-cream-soft dark:hover:bg-arcade-dark text-arcade-ink dark:text-arcade-cream",
            )}
          >
            <div className="font-pixel text-[10px] uppercase tracking-widest">
              {t.label}
            </div>
            <div className="text-[10px] opacity-80 font-pixel mt-1">
              {t.sub}
            </div>
          </button>
        );
      })}
    </div>
  );
}
