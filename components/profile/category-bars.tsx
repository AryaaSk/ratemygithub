import type { CategoryKey } from "@/lib/scoring/rubric";
import { CATEGORIES, tierForScore } from "@/lib/scoring/rubric";

type Props = {
  scores: Record<CategoryKey, number>;
};

export function CategoryBars({ scores }: Props) {
  return (
    <ul className="space-y-3">
      {CATEGORIES.map((c) => {
        const v = scores[c.key] ?? 0;
        const t = tierForScore(v);
        return (
          <li key={c.key} className="grid grid-cols-[110px_1fr_auto] items-center gap-3">
            <div>
              <div className="font-pixel text-[10px] uppercase">{c.label}</div>
              <div className="font-pixel text-[8px] uppercase opacity-60">
                {Math.round(c.weight * 100)}% weight
              </div>
            </div>
            <div className="pixel-border-sm bg-arcade-cream-soft dark:bg-arcade-dark h-5 overflow-hidden">
              <div
                className="h-full"
                style={{ width: `${v}%`, backgroundColor: t.color }}
              />
            </div>
            <div className="flex items-baseline gap-1 min-w-[72px] justify-end">
              <span className="font-score text-xl tabular-nums">
                {Math.round(v)}
              </span>
              <span className="font-pixel text-[9px]" style={{ color: t.color }}>
                {t.tier}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
