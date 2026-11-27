"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2, ChevronRight, MinusCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { ExecutiveAttention, ExecutiveFilterKey } from "@/types/executive-dashboard";
import type { EndpointSource } from "../../_hooks/use-executive-endpoints";
import { attentionView, type AttentionRow } from "../../_lib/attention";

const TONE = {
  attention: { icon: AlertTriangle, className: "text-amber-500" },
  clear: { icon: CheckCircle2, className: "text-emerald-600" },
  neutral: { icon: MinusCircle, className: "text-muted-foreground" },
} as const;

function RuleBody({ row }: { row: AttentionRow }) {
  const { icon: Icon, className } = TONE[row.tone];
  return (
    <>
      <Icon className={cn("mt-0.5 size-4 shrink-0", className)} aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-baseline justify-between gap-x-2">
          <span className="text-sm font-medium">{row.label}</span>
          <span className={cn("text-xs font-medium", className)}>{row.stateText}</span>
        </span>
        <span className="block text-sm">{row.title}</span>
        <span className="block text-xs text-muted-foreground">{row.detail}</span>
        <span className="block text-[11px] text-muted-foreground">{row.basis}</span>
        {row.filterNote ? <span className="block text-[11px] text-amber-700 dark:text-amber-400">{row.filterNote}</span> : null}
      </span>
    </>
  );
}

/**
 * Requires Attention, from `GET /dashboard/executive/attention`: every rule
 * in the server's words, those needing attention first, each with the period
 * or day it reads. A failed load says so; it never reads as "all clear".
 */
export function AttentionPanel({ source, sentFilters }: { source: EndpointSource<ExecutiveAttention>; sentFilters: ExecutiveFilterKey[] }) {
  const view = source.state === "ready" ? attentionView(source.data, sentFilters) : null;

  return (
    <Card className="rounded-xl border border-border shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <AlertTriangle className="size-4 text-amber-500" aria-hidden="true" />
          Requires Attention
          {view && view.count > 0 ? <span className="rounded-full bg-muted px-2 text-xs font-medium">{view.count}</span> : null}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {source.state === "loading" ? (
          <Skeleton className="h-32 w-full" />
        ) : source.state === "refused" ? (
          <p className="text-sm text-muted-foreground" role="status">
            Not available: {source.message}
          </p>
        ) : !view ? (
          <p className="text-sm text-muted-foreground" role="status">
            Not available: the checks couldn&apos;t be loaded.
          </p>
        ) : view.rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No checks are set up.</p>
        ) : (
          <ul className="divide-y">
            {view.rows.map((row) => (
              <li key={row.key}>
                {row.href ? (
                  <Link href={row.href} className="flex items-start gap-3 rounded-md py-2.5 hover:bg-muted/50">
                    <RuleBody row={row} />
                    <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  </Link>
                ) : (
                  <div className="flex items-start gap-3 py-2.5">
                    <RuleBody row={row} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
