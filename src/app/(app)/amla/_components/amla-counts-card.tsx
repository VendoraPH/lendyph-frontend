"use client";

import Link from "next/link";
import { useState } from "react";
import { DataState } from "@/components/common/data-state";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useApiResource } from "@/hooks";
import { once } from "@/lib/amla/once";
import { amlaReportApi } from "@/lib/amla/report-api";
import { amlaCountBlocks } from "@/lib/amla/report-view";

/**
 * The server's AMLA counts, one block per area the caller holds a key for
 * (`GET /amla/dashboard/counts`). Nothing is counted on the page.
 */
export function AmlaCountsCard() {
  const [fetcher] = useState(() => once(() => amlaReportApi.dashboardCounts()));
  const resource = useApiResource(fetcher);
  return (
    <DataState
      resource={resource}
      summary="Open alerts by priority, CTR candidates, cases, filing deadlines and due diligence, as counted by the server."
      endpoints={["GET /amla/dashboard/counts"]}
      isEmpty={(counts) => amlaCountBlocks(counts).length === 0}
      emptyMessage="Your role holds no AMLA area with counts."
    >
      {(counts) => (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {amlaCountBlocks(counts).map((block) => (
            <Card key={block.key}>
              <CardHeader className="flex flex-row items-start justify-between gap-2">
                <div className="space-y-1">
                  <CardTitle className="text-base">{block.title}</CardTitle>
                  {block.total !== null && <CardDescription>{block.total} in all</CardDescription>}
                </div>
                <Link href={block.href} className="text-sm whitespace-nowrap underline-offset-4 hover:underline">
                  {block.linkText}
                </Link>
              </CardHeader>
              <CardContent>
                <dl className="space-y-1.5 text-sm">
                  {block.lines.map((line) => (
                    <div key={line.key} className="flex items-baseline justify-between gap-3">
                      <dt className="text-muted-foreground">{line.label}</dt>
                      <dd className={line.urgent ? "font-semibold text-destructive tabular-nums" : "font-medium tabular-nums"}>{line.text}</dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </DataState>
  );
}
