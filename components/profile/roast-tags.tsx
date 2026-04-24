import type { RoastTag } from "@/lib/mock";
import { cn } from "@/lib/utils";
import { BuiltWithZoralCard } from "@/components/zoral/built-with-card";

const FLAVORS: Record<RoastTag["flavor"], string> = {
  red: "bg-arcade-red text-arcade-cream",
  blue: "bg-arcade-blue text-arcade-cream",
  green: "bg-arcade-green text-arcade-ink",
  yellow: "bg-arcade-yellow text-arcade-ink",
  purple: "bg-arcade-purple text-arcade-cream",
};

export function RoastTags({ roasts }: { roasts: RoastTag[] }) {
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      {roasts.map((r, i) => (
        <div
          key={i}
          className={cn("pixel-border p-4 space-y-2", FLAVORS[r.flavor])}
        >
          <p className="font-pixel text-[10px] uppercase tracking-widest">
            {r.label}
          </p>
          <p className="text-xs leading-snug">{r.body}</p>
        </div>
      ))}
      <BuiltWithZoralCard />
    </div>
  );
}
