"use client";

import Link from "next/link";
import { AlertOctagon, AlertTriangle, CheckCircle2, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { attentionItems, attentionStatus } from "../../_lib/attention";
import type { ExecutiveData } from "../../_lib/executive-data";

/**
 * What needs someone's attention now, critical first, from today's figures
 * whatever the period (until EB-FE2 reads `/attention`). Nothing is raised
 * from data that failed to load, and it never says "nothing needs attention"
 * when some of its data failed.
 */
export function AttentionPanel({ data }: { data: ExecutiveData }) {
  const items = attentionItems(data);
  const status = attentionStatus(data);

  return (
    <Card className="rounded-xl border border-border shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <AlertTriangle className="size-4 text-amber-500" aria-hidden="true" />
          Requires Attention
          {items.length > 0 ? <span className="rounded-full bg-muted px-2 text-xs font-medium">{items.length}</span> : null}
        </CardTitle>
        <p className="text-xs text-muted-foreground">As of today</p>
      </CardHeader>
      <CardContent>
        {items.length === 0 && status === "failed" ? (
          <p className="text-sm text-muted-foreground" role="status">
            Not available: some of the figures these checks read couldn&apos;t be loaded.
          </p>
        ) : items.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="size-4 text-emerald-600" aria-hidden="true" />
            {status === "loading" ? "Checking…" : "Nothing needs attention right now."}
          </p>
        ) : (
          <ul className="divide-y">
            {items.map((a) => {
              const Icon = a.tone === "critical" ? AlertOctagon : AlertTriangle;
              return (
                <li key={a.id}>
                  <Link href={a.href} className="flex items-start gap-3 rounded-md py-2.5 hover:bg-muted/50">
                    <Icon
                      className={cn("mt-0.5 size-4 shrink-0", a.tone === "critical" ? "text-red-600" : "text-amber-500")}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">
                        <span className="sr-only">{a.tone === "critical" ? "Critical: " : "Warning: "}</span>
                        {a.title}
                      </span>
                      <span className="block text-xs text-muted-foreground">{a.detail}</span>
                    </span>
                    <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        {items.length > 0 && status === "failed" ? (
          <p className="mt-2 text-xs text-muted-foreground">Some checks couldn&apos;t run: part of their data couldn&apos;t be loaded.</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
