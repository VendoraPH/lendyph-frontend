"use client";

import { useCallback } from "react";
import { DataState } from "@/components/common/data-state";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApiResource } from "@/hooks";
import { cdaService } from "@/services";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import { formatDate } from "@/lib/format";
import type { CdaPesos } from "@/types/cda";
import { ToneBadge } from "../../_components/tone-badge";
import { PESOS_DIRECTION_LABELS, PESOS_STATUS_META, labelOf } from "../../_lib/labels";
import { asSent } from "../../_lib/money";

function Score({ data }: { data: CdaPesos }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>Enhanced PESOS score, as of {formatDate(data.as_of)}</CardDescription>
        <CardTitle className="text-3xl tabular-nums">{asSent(data.score)}</CardTitle>
        <div className="flex flex-wrap gap-2">
          {data.rating && <ToneBadge tone="info" label={data.rating} />}
          {!data.complete && <ToneBadge tone="warning" label="Incomplete: some indicators have no score" />}
          {(!data.verified || data.provisional) && <ToneBadge tone="warning" label="To verify" />}
        </div>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <ul className="divide-y">
          {data.components.map((c) => (
            <li key={c.key} className="flex items-center justify-between gap-2 py-1.5">
              <span>
                {c.label} <span className="text-xs text-muted-foreground">(weight {asSent(c.weight)})</span>
              </span>
              <span className="tabular-nums font-medium">{asSent(c.score)}</span>
            </li>
          ))}
        </ul>
        {data.trend.length > 0 && (
          <p className="pt-2 text-xs text-muted-foreground">
            By year: {data.trend.map((t) => `${t.year}: ${asSent(t.score)}`).join(" · ")}
          </p>
        )}
        {data.template && (
          <p className="text-xs text-muted-foreground">
            Template {data.template.name}, version {data.template.version}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function Indicators({ data }: { data: CdaPesos }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Indicators</CardTitle>
        <CardDescription>Each figure, formula and source is the server&apos;s, shown for the auditor.</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Indicator</TableHead>
              <TableHead>Formula</TableHead>
              <TableHead className="text-right">Value</TableHead>
              <TableHead className="text-right">Score</TableHead>
              <TableHead className="text-right">Weight</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.metrics.map((m) => {
              const status = PESOS_STATUS_META[m.status] ?? { label: "Other", tone: "neutral" as const };
              return (
                <TableRow key={m.key}>
                  <TableCell>
                    <p className="font-medium">{m.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {labelOf(PESOS_DIRECTION_LABELS, m.direction)}
                      {m.source && ` · Source: ${m.source}`}
                    </p>
                    {m.recommendation && <p className="text-xs italic text-muted-foreground">{m.recommendation}</p>}
                  </TableCell>
                  <TableCell className="text-xs">{m.formula}</TableCell>
                  <TableCell className="text-right tabular-nums">{asSent(m.value)}</TableCell>
                  <TableCell className="text-right tabular-nums">{asSent(m.score)}</TableCell>
                  <TableCell className="text-right tabular-nums">{asSent(m.weight)}</TableCell>
                  <TableCell>
                    <ToneBadge tone={status.tone} label={status.label} />
                    {m.note && <p className="mt-1 text-xs text-muted-foreground">{m.note}</p>}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/**
 * The server's Enhanced PESOS assessment. Scores, weights and values are
 * strings from the server, shown as sent; the template is marked "to verify"
 * until it is checked against CDA's official tool.
 */
export function PesosAssessment({ year }: { year: number }) {
  const resource = useApiResource(useCallback(() => cdaService.getPesos(year), [year]));
  return (
    <DataState resource={resource} endpoints={[`GET ${API_ENDPOINTS.CDA.PESOS(year)}`]} summary={`The ${year} Enhanced PESOS score`}>
      {(data) => (
        <div className="space-y-4">
          <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
            {data.disclosure}
          </p>
          <div className="grid gap-4 lg:grid-cols-[20rem_minmax(0,1fr)]">
            <Score data={data} />
            <Indicators data={data} />
          </div>
          {data.to_verify.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Still to verify against CDA&apos;s tool</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {data.to_verify.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </DataState>
  );
}
