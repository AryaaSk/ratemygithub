"use client";

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import type { LanguageSlice } from "@/lib/mock";

const PALETTE = [
  "var(--color-arcade-red)",
  "var(--color-arcade-blue)",
  "var(--color-arcade-green-deep)",
  "var(--color-arcade-yellow)",
  "var(--color-arcade-purple)",
  "var(--color-tier-d)",
];

export function LanguageDonut({ slices }: { slices: LanguageSlice[] }) {
  return (
    <div className="grid grid-cols-[160px_1fr] gap-4 items-center">
      <div className="w-[160px] h-[160px] relative">
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={slices}
              dataKey="pct"
              innerRadius={50}
              outerRadius={78}
              startAngle={90}
              endAngle={-270}
              stroke="var(--color-arcade-ink)"
              strokeWidth={2}
            >
              {slices.map((_, i) => (
                <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex items-center justify-center font-pixel text-[9px] uppercase">
          {slices.length} langs
        </div>
      </div>
      <ul className="space-y-1.5">
        {slices.map((s, i) => (
          <li key={s.language} className="flex items-center gap-2 text-xs">
            <span
              className="w-3 h-3 pixel-border-sm inline-block"
              style={{
                backgroundColor: PALETTE[i % PALETTE.length],
                boxShadow: "none",
                borderWidth: 1,
              }}
            />
            <span className="flex-1 font-pixel text-[10px] uppercase">
              {s.language}
            </span>
            <span className="font-score text-base tabular-nums">{s.pct}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
