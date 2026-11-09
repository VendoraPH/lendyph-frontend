"use client";

import { useCallback, useMemo } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataState } from "@/components/common/data-state";
import { useApiResource, useIsClient } from "@/hooks";
import { creditScoringService } from "@/services";
import { MAX_PER_PAGE } from "@/lib/paginate";
import { formatDate, formatDateTime } from "@/lib/format";
import { historyChartCaption, historyChartPoints } from "@/lib/credit-scoring/history-chart";
import type { CreditScoreHistoryEntry, CreditScoringPage } from "@/types/credit-scoring";

const CHART_CONFIG = {
  score: { label: "Score", color: "var(--chart-1)" },
} satisfies ChartConfig;

/**
 * The member's score over time, from their latest 100 history rows, oldest
 * to newest. An insufficient-data row is a gap in the line, never 0.
 */
export function ScoreHistoryChart({ borrowerId }: { borrowerId: number }) {
  const mounted = useIsClient();
  const fetcher = useCallback(
    () => creditScoringService.getBorrowerScoreHistory(borrowerId, { page: 1, per_page: MAX_PER_PAGE }),
    [borrowerId],
  );
  const resource = useApiResource<CreditScoringPage<CreditScoreHistoryEntry>>(fetcher);
  const points = useMemo(() => historyChartPoints(resource.data?.data ?? []), [resource.data]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Score History</CardTitle>
      </CardHeader>
      <CardContent>
        <DataState
          resource={resource}
          summary="This member's score over time."
          endpoints={[`GET /credit-scoring/borrowers/${borrowerId}/history`]}
          isEmpty={(res) => res.total === 0}
          emptyMessage="No scores recorded yet."
        >
          {(res) => {
            const caption = historyChartCaption(res.data.length, res.total);
            return (
              <figure className="space-y-2">
                {mounted && (
                  <ChartContainer
                    config={CHART_CONFIG}
                    className="aspect-auto h-56 w-full"
                    role="img"
                    aria-label={`Score over time, ${points.length} scores`}
                  >
                    <LineChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
                      <CartesianGrid vertical={false} />
                      <XAxis
                        dataKey="calculated_at"
                        tickLine={false}
                        axisLine={false}
                        minTickGap={24}
                        tickFormatter={(v: string) => formatDate(v)}
                      />
                      <YAxis domain={[0, 100]} tickLine={false} axisLine={false} width={40} />
                      <ChartTooltip
                        content={
                          <ChartTooltipContent
                            labelFormatter={(_, payload) => {
                              const at = payload?.[0]?.payload?.calculated_at;
                              return typeof at === "string" ? formatDateTime(at) : "";
                            }}
                          />
                        }
                      />
                      <Line
                        dataKey="score"
                        type="monotone"
                        stroke="var(--color-score)"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        connectNulls={false}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ChartContainer>
                )}
                {caption && <figcaption className="text-xs text-muted-foreground">{caption}</figcaption>}
              </figure>
            );
          }}
        </DataState>
      </CardContent>
    </Card>
  );
}
