"use client";

import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Info, Minus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { CardView } from "../../_lib/executive-overview";

const TONE_CLASS = {
  good: "text-emerald-600 dark:text-emerald-400",
  bad: "text-red-600 dark:text-red-400",
  flat: "text-muted-foreground",
} as const;

const TITLE_CLASS = "text-left text-xs font-medium text-muted-foreground after:absolute after:inset-0 hover:text-foreground";

/**
 * One Executive Overview card, from `GET /dashboard/executive/overview`: the
 * server's value, change, previous value and as-of date, or its state in
 * words ("No snapshot for this date", "Requires configuration"). The PAR card
 * opens its loans (`onOpenPar`) when the user may read them.
 */
export function KpiCard({ card, onOpenPar }: { card: CardView; onOpenPar: (() => void) | null }) {
  const ChangeIcon = card.changeTone === "flat" ? Minus : card.changeText?.startsWith("+") ? ArrowUpRight : ArrowDownRight;
  const ready = card.state === "ready";

  return (
    <Card size="sm" className="relative h-full rounded-xl border border-border shadow-sm transition-shadow hover:shadow-md">
      <CardContent className="flex h-full flex-col gap-1.5">
        <div className="flex items-start justify-between gap-2">
          {card.href === "par" ? (
            onOpenPar ? (
              <button type="button" onClick={onOpenPar} className={TITLE_CLASS}>
                {card.label}
              </button>
            ) : (
              <span className="text-xs font-medium text-muted-foreground">{card.label}</span>
            )
          ) : (
            <Link href={card.href} className={TITLE_CLASS}>
              {card.label}
            </Link>
          )}
          {card.formula ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      aria-label={`How ${card.label} is worked out`}
                      className="relative z-10 -m-1 rounded p-1 text-muted-foreground hover:text-foreground"
                    />
                  }
                >
                  <Info className="size-3.5" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-72">
                  <p>{card.formula}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : null}
        </div>

        <p
          className={cn("font-bold tabular-nums leading-tight", ready ? "text-xl" : "text-sm text-muted-foreground")}
          title={ready ? card.valueText : undefined}
        >
          {card.compactText}
        </p>

        {card.previousText ? <p className="text-[11px] text-muted-foreground">{card.previousText}</p> : null}
        {card.filterNote ? <p className="text-[11px] text-amber-700 dark:text-amber-400">{card.filterNote}</p> : null}

        <div className="mt-auto flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-[11px]">
          <span className="text-muted-foreground">{card.asOfText}</span>
          {card.changeText !== null ? (
            <span className={cn("inline-flex items-center gap-0.5 font-medium tabular-nums", TONE_CLASS[card.changeTone])}>
              <ChangeIcon className="size-3" aria-hidden="true" />
              {card.changeText}
              <span className="sr-only"> {card.changeBasis}</span>
            </span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

/** A card's place while the overview loads. */
export function KpiCardSkeleton() {
  return (
    <Card size="sm" className="h-full rounded-xl border border-border shadow-sm">
      <CardContent className="flex h-full flex-col gap-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-7 w-28" />
        <Skeleton className="mt-auto h-3 w-20" />
      </CardContent>
    </Card>
  );
}
