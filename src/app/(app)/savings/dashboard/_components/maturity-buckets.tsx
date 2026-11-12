"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatValue } from "@/lib/report-format";
import type { SavingsMaturityBucket } from "@/types/savings-insight";
import { bucketPoints, compactPesoAxis, type BucketPoint } from "../_lib/dashboard-view";

const CONFIG = {
  maturity_amount: { label: "Due at maturity", color: "var(--chart-2)" },
} satisfies ChartConfig;

/** Time deposits outstanding by days to maturity; one past due and unsettled is in the first bucket. */
export function MaturityBuckets({ buckets, asOf }: { buckets: readonly SavingsMaturityBucket[] | undefined; asOf: string }) {
  const points = bucketPoints(buckets);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Maturity schedule</CardTitle>
        <CardDescription>Time deposits outstanding, by days to maturity from {formatValue(asOf, "date")}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-2">
        {points.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground lg:col-span-2">No time deposits outstanding.</p>
        ) : (
          <>
            <ChartContainer config={CONFIG} className="aspect-auto h-[220px] w-full" aria-hidden="true">
              <BarChart data={points} margin={{ left: 4, right: 8 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis tickLine={false} axisLine={false} width={64} tickFormatter={(v: number) => compactPesoAxis(v)} />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(_value, _name, item) => (
                        <span className="font-mono tabular-nums">{(item as { payload?: BucketPoint }).payload?.due ?? "—"}</span>
                      )}
                    />
                  }
                />
                <Bar dataKey="maturity_amount" fill="var(--color-maturity_amount)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ChartContainer>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Days to maturity</TableHead>
                  <TableHead scope="col" className="text-right">
                    Time deposits
                  </TableHead>
                  <TableHead scope="col" className="text-right">
                    Principal
                  </TableHead>
                  <TableHead scope="col" className="text-right">
                    Due at maturity
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {points.map((p) => (
                  <TableRow key={p.key}>
                    <TableCell className="text-sm">{p.label}</TableCell>
                    <TableCell className="text-right font-mono text-sm tabular-nums">{p.count}</TableCell>
                    <TableCell className="text-right font-mono text-sm tabular-nums">{p.principal}</TableCell>
                    <TableCell className="text-right font-mono text-sm tabular-nums">{p.due}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
      </CardContent>
    </Card>
  );
}
