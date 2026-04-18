type Props = {
  /** 52 × 7 grid, values 0..4 */
  weeks: number[][];
  /** 365 when sourced from GraphQL, 90 when we fell back to public events. */
  windowDays?: number;
};

const COLORS = [
  "transparent",
  "#9eff4a66",
  "#9eff4aaa",
  "#5ec614",
  "#3a8d0b",
];

export function CommitHeatmap({ weeks, windowDays = 365 }: Props) {
  const total = weeks.flat().filter((n) => n > 0).length;
  const label =
    windowDays >= 365 ? "365-day commit heatmap" : `${windowDays}-day commit heatmap (public events only)`;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="font-pixel text-[10px] uppercase tracking-widest opacity-80">
          {label}
        </p>
        <p className="font-pixel text-[9px] uppercase opacity-60">
          {total} active days
        </p>
      </div>
      <div className="pixel-border-sm bg-arcade-cream-soft dark:bg-arcade-dark p-3 overflow-x-auto">
        <div className="flex gap-[3px] min-w-max">
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-[3px]">
              {week.map((v, di) => (
                <div
                  key={di}
                  title={`Week ${wi + 1} · Day ${di + 1}: ${v} commits`}
                  className="w-[11px] h-[11px] pixel-border-sm"
                  style={{
                    backgroundColor: COLORS[v],
                    boxShadow: "none",
                    borderWidth: 1,
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2 font-pixel text-[9px] uppercase opacity-70">
        <span>Less</span>
        {COLORS.map((c, i) => (
          <div
            key={i}
            className="w-[11px] h-[11px] border border-arcade-ink/30"
            style={{ backgroundColor: c }}
          />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}
