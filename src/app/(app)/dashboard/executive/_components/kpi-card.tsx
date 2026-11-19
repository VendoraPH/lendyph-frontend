"use client";

import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Info, Minus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { isAsOfToday, type KpiView } from "../../_lib/executive-data";
import { DATA_UNAVAILABLE, METRICS, changeTone, formatChange, formatMetric } from "../../_lib/metrics";

const TONE_CLASS = {
  good: "text-emerald-600 dark:text-emerald-400",
  bad: "text-red-600 dark:text-red-400",
  flat: "text-muted-foreground",
} as const;

/**
 * One Executive Overview figure: value, what it covers, the change against
 * its comparison, the formula on hover, and a link to the detail behind it.
 */
export function KpiCard({ kpi, periodTo }: { kpi: KpiView; periodTo: string }) {
  const m = METRICS[kpi.id];
  const change = formatChange(kpi.change, m.kind);
  const tone = changeTone(kpi.change, "lowerIsBetter" in m ? m.lowerIsBetter : false);
  const ChangeIcon = tone === "flat" ? Minus : (kpi.change ?? 0) > 0 ? ArrowUpRight : ArrowDownRight;
  const scope = isAsOfToday(kpi.id) ? "As of today" : m.kind === "balance" ? `As of ${formatDate(periodTo)}` : "For the period";

  return (
    <Card size="sm" className="relative h-full rounded-xl border border-border shadow-sm transition-shadow hover:shadow-md">
      <CardContent className="flex h-full flex-col gap-1.5">
        <div className="flex items-start justify-between gap-2">
          <Link href={m.href} className="text-xs font-medium text-muted-foreground after:absolute after:inset-0 hover:text-foreground">
            {m.label}
          </Link>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    aria-label={`How ${m.label} is calculated`}
                    className="relative z-10 -m-1 rounded p-1 text-muted-foreground hover:text-foreground"
                  />
                }
              >
                <Info className="size-3.5" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-72">
                <p>{m.formula}</p>
                {process.env.NODE_ENV === "development" ? (
                  <p className="mt-1 font-mono text-[10px] opacity-80">{m.source}</p>
                ) : null}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {kpi.state === "loading" ? (
          <Skeleton className="h-7 w-24" />
        ) : (
          <p
            className={cn(
              "font-bold tabular-nums leading-tight",
              kpi.state === "ready" ? "text-xl" : "text-sm text-muted-foreground",
            )}
            title={kpi.state === "ready" ? formatMetric(kpi.value, m.format) : undefined}
          >
            {kpi.state === "denied" ? "No access" : kpi.state === "ready" ? formatMetric(kpi.value, m.format, true) : DATA_UNAVAILABLE}
          </p>
        )}

        <div className="mt-auto flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-[11px]">
          <span className="text-muted-foreground">{scope}</span>
          {kpi.state === "ready" && change !== null ? (
            <span className={cn("inline-flex items-center gap-0.5 font-medium tabular-nums", TONE_CLASS[tone])}>
              <ChangeIcon className="size-3" aria-hidden="true" />
              {change}
              <span className="sr-only">
                {kpi.changeBasis === "opening_balance" ? " against the opening balance" : " against the previous period"}
              </span>
            </span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
