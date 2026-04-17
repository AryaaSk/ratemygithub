"use client";

import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from "recharts";
import type { CategoryKey } from "@/lib/scoring/rubric";
import { CATEGORIES } from "@/lib/scoring/rubric";

type Props = {
  scores: Record<CategoryKey, number>;
  /** Optional second series for comparison. */
  compareScores?: Record<CategoryKey, number>;
  compareLabel?: string;
};

export function CategoryRadar({ scores, compareScores, compareLabel }: Props) {
  const data = CATEGORIES.map((c) => ({
    subject: c.label,
    you: scores[c.key] ?? 0,
    them: compareScores?.[c.key] ?? 0,
  }));

  return (
    <div className="w-full h-[360px]">
      <ResponsiveContainer>
        <RadarChart data={data} outerRadius="75%">
          <PolarGrid stroke="currentColor" strokeOpacity={0.25} />
          <PolarAngleAxis
            dataKey="subject"
            tick={{
              fontFamily: "var(--font-press-start)",
              fontSize: 9,
              fill: "currentColor",
            }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tick={false}
            axisLine={false}
          />
          <Radar
            name="You"
            dataKey="you"
            stroke="var(--color-arcade-red)"
            fill="var(--color-arcade-red)"
            fillOpacity={0.4}
            strokeWidth={2}
          />
          {compareScores && (
            <Radar
              name={compareLabel ?? "Compare"}
              dataKey="them"
              stroke="var(--color-arcade-blue)"
              fill="var(--color-arcade-blue)"
              fillOpacity={0.25}
              strokeWidth={2}
            />
          )}
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
