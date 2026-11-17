import { PieChart, Pie, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { formatCurrency } from "@/lib/format";
import type { CollectionPieSlice } from "../_lib/collection-pie";

/**
 * Today's expected against actual collection, as the server's summary states
 * it. The ring scales with the window's height (7–11rem), so it never clips
 * on a 768px-tall screen, and it sits centred in its column beside the table.
 */
export function DuesDonut({
  rate,
  rateLabel,
  slices,
  mounted,
}: {
  rate: number | null;
  rateLabel: string;
  slices: CollectionPieSlice[];
  /** Charts measure their box, so they draw only in the browser. */
  mounted: boolean;
}) {
  return (
    <div className="flex shrink-0 flex-col items-center justify-center gap-2 px-4 @xl:w-60 @xl:self-stretch">
      <div className="relative size-[clamp(7rem,22dvh,11rem)]">
        {rate === null ? (
          // Nothing due (or no summary yet): an empty ring, since a pie of zeros draws nothing.
          <svg aria-hidden="true" viewBox="0 0 100 100" className="absolute inset-0 size-full text-muted">
            <circle cx="50" cy="50" r="38.5" fill="none" stroke="currentColor" strokeWidth="15" />
          </svg>
        ) : mounted ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={slices}
                cx="50%"
                cy="50%"
                innerRadius="62%"
                outerRadius="92%"
                paddingAngle={3}
                dataKey="value"
                strokeWidth={0}
                isAnimationActive={false}
              >
                {slices.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => formatCurrency(Number(value))}
                contentStyle={{ borderRadius: 8, fontSize: 12, border: "1px solid var(--border)" }}
              />
            </PieChart>
          </ResponsiveContainer>
        ) : null}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-xl font-bold">{rateLabel}</p>
          <p className="text-[11px] text-muted-foreground">Collected</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
        {slices.map((entry) => (
          <div key={entry.name} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
            <span className="text-[11px] text-muted-foreground">{entry.name}</span>
          </div>
        ))}
      </div>
      <p className="text-center text-[11px] text-muted-foreground">Expected vs actual collection today</p>
    </div>
  );
}
