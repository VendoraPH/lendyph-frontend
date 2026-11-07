"use client";

import { useCallback } from "react";
import { RouteGuard } from "@/components/common";
import { DataState } from "@/components/common/data-state";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApiResource } from "@/hooks";
import { cdaService } from "@/services";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import { formatValue } from "@/lib/report-format";
import type { CdaPesosAssessment } from "@/types/cda";
import { ReportWorkspace } from "../_components/report-workspace";
import { ReadinessMeter } from "../_components/readiness-meter";
import { useCdaYear } from "../_hooks/use-cda-year";

function Assessment({ data }: { data: CdaPesosAssessment }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <Card>
        <CardHeader>
          <CardDescription>Enhanced PESOS score</CardDescription>
          <CardTitle className="text-3xl tabular-nums">{formatValue(data.score, "number")}</CardTitle>
          {data.rating && <p className="text-sm font-medium">{data.rating}</p>}
        </CardHeader>
        <CardContent className="space-y-3">
          {data.components.map((c) => (
            <ReadinessMeter key={c.key} value={c.score ?? 0} label={`${c.label} (${c.weight}%)`} />
          ))}
          {data.trend.length > 0 && (
            <div className="pt-2 text-xs text-muted-foreground">
              Trend:{" "}
              {data.trend.map((t) => `FY ${t.year} ${formatValue(t.score, "number")}`).join(" · ")}
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Indicators</CardTitle>
          <CardDescription>Each figure is computed from the books; the formula and source are shown for the auditor.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Component</TableHead>
                <TableHead>Indicator</TableHead>
                <TableHead>Formula</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead className="text-right">Score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.metrics.map((m) => (
                <TableRow key={m.key}>
                  <TableCell>{m.component}</TableCell>
                  <TableCell>
                    {m.label}
                    <span className="block text-xs text-muted-foreground">Source: {m.source}</span>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{m.formula}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatValue(m.value, "number")}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatValue(m.score, "number")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function PesosScore() {
  const year = useCdaYear();
  const resource = useApiResource(useCallback(() => cdaService.getPesos(year), [year]));
  return (
    <DataState
      resource={resource}
      endpoints={[`GET ${API_ENDPOINTS.CDA.PESOS(year)}`]}
      summary={`The FY ${year} PESOS score with every indicator`}
    >
      {(data) => <Assessment data={data} />}
    </DataState>
  );
}

export default function Page() {
  return (
    <RouteGuard permission="cda:view" pageName="Enhanced PESOS">
      <ReportWorkspace type="pesos">
        <PesosScore />
      </ReportWorkspace>
    </RouteGuard>
  );
}
