import { PieChart, Pie, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Illustration, hasIllustration } from "@/components/common/illustration";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { donutPaddingAngle, type CollectionPieSlice, type TodaySummaryRow } from "../_lib/collection-pie";
import { DUES_DONUT_COLUMN_CLASS, DUES_EMPTY_PICTURE_CLASS, DUES_RING_SIZE_CLASS } from "../_lib/kpi-layout";

/**
 * Today's expected against actual collection, as the server's summary states
 * it, with the "Today" list of the summary's figures under it. The ring scales
 * with the window's height (`DUES_RING_SIZE_CLASS`). Its panel runs the table panel's height on a wide card, with the
 * ring and list at the top, level with the table's headings.
 *
 * On a day with nothing due, the ring, its key and its caption give way to the
 * "all caught up" picture; the list still shows its ₱0.00 rows.
 */
export function DuesDonut({
  rate,
  rateLabel,
  slices,
  rows,
  nothingDue,
  mounted,
}: {
  rate: number | null;
  rateLabel: string;
  slices: CollectionPieSlice[];
  rows: TodaySummaryRow[];
  nothingDue: boolean;
  /** Charts measure their box, so they draw only in the browser. */
  mounted: boolean;
}) {
  return (
    <div className={DUES_DONUT_COLUMN_CLASS}>
      {nothingDue ? (
        <div className="flex flex-col items-center gap-2 py-2">
          {hasIllustration("allCaughtUp") ? (
            <Illustration name="allCaughtUp" className={DUES_EMPTY_PICTURE_CLASS} />
          ) : null}
          <p className="text-sm font-medium">Nothing due today</p>
        </div>
      ) : (
        <>
          <div className={cn("relative shrink-0", DUES_RING_SIZE_CLASS)}>
            {rate === null ? (
              // Still loading, or the request failed: an empty ring, since a pie of zeros draws nothing.
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
                    paddingAngle={donutPaddingAngle(slices)}
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
        </>
      )}
      <div className="w-full border-t pt-2">
        <h3 className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Today</h3>
        <dl className="flex flex-col gap-1">
          {rows.map((row) => (
            <div key={row.key} className="flex items-start justify-between gap-2">
              <dt className="min-w-0 text-xs leading-tight">
                {row.label}
                {row.detail ? (
                  <span className="block text-[10px] text-muted-foreground">{row.detail}</span>
                ) : null}
              </dt>
              <dd className="shrink-0 text-xs font-medium leading-tight tabular-nums">{row.amountLabel}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
