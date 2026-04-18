import type { TimelineEntry } from "@/lib/mock";

export function Timeline({ entries }: { entries: TimelineEntry[] }) {
  return (
    <ol className="space-y-3">
      {entries.map((e, i) => {
        const d = new Date(e.date);
        const label = d.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
        return (
          <li
            key={i}
            className="grid grid-cols-[110px_16px_1fr] gap-4 items-start"
          >
            <div className="font-pixel text-[10px] uppercase opacity-80 pt-1 text-right">
              {label}
            </div>
            <div className="flex flex-col items-center h-full">
              <div className="w-3 h-3 bg-arcade-red pixel-border-sm" />
              {i !== entries.length - 1 && (
                <div className="w-0.5 flex-1 bg-arcade-ink/30 dark:bg-arcade-cream/30 mt-1" />
              )}
            </div>
            <div className="pb-4 text-sm leading-snug">{e.label}</div>
          </li>
        );
      })}
    </ol>
  );
}
