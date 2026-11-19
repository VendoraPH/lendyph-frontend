"use client";

import Link from "next/link";
import { useState } from "react";
import { AmlaNoteDialog, type AmlaNoteAction } from "@/components/amla/amla-note-dialog";
import { DataState } from "@/components/common/data-state";
import { PageFill, ScrollBox } from "@/components/common/page-fill";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useApiResource } from "@/hooks";
import { once } from "@/lib/amla/once";
import { amlaScreeningApi } from "@/lib/amla/screening-api";
import { amlaMatchLines, amlaMatchRow } from "@/lib/amla/screening-view";
import type { AmlaScreeningMatchDetail } from "@/types/amla-screening";

/** One possible match: why it scored, the listing's details, and a person's decision, made once. Read once. */
export function MatchDetail({ id }: { id: number }) {
  const [fetcher, setFetcher] = useState(() => once(() => amlaScreeningApi.match(id)));
  const resource = useApiResource(fetcher);
  return (
    <PageFill>
      <Link href="/amla/screening" className="shrink-0 text-sm text-muted-foreground underline-offset-4 hover:underline">
        Back to Screening
      </Link>
      <DataState resource={resource} summary="This possible match and its reasons." endpoints={["GET /amla/screening/matches/{id}"]}>
        {(match) => <MatchBody match={match} onDecided={() => setFetcher(() => once(() => amlaScreeningApi.match(id)))} />}
      </DataState>
    </PageFill>
  );
}

function MatchBody({ match, onDecided }: { match: AmlaScreeningMatchDetail; onDecided: () => void }) {
  const row = amlaMatchRow(match);
  const lines = amlaMatchLines(match);
  const [action, setAction] = useState<AmlaNoteAction | null>(null);

  const decide = (kind: "confirm" | "clear") =>
    setAction(
      kind === "confirm"
        ? {
            title: "Confirm this match?",
            description: `${row.subject} is the person listed as ${row.listed}. This records the finding only: it places no hold and files nothing. It can't be undone.`,
            label: "Reason",
            required: true,
            confirmLabel: "Confirm match",
            destructive: true,
            success: "Match confirmed",
            failure: "The match couldn't be confirmed.",
            run: (reason) => amlaScreeningApi.confirm(match.id, reason),
          }
        : {
            title: "Clear this match?",
            description: `${row.subject} is not the person listed as ${row.listed}. It can't be undone.`,
            label: "Reason",
            required: true,
            confirmLabel: "Clear as a false positive",
            success: "Match cleared",
            failure: "The match couldn't be cleared.",
            run: (reason) => amlaScreeningApi.clear(match.id, reason),
          },
    );

  return (
    <ScrollBox className="space-y-4 p-px">
      <div className="space-y-1">
        <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight">
          {row.subject}
          <Badge variant={row.pending ? "secondary" : "outline"}>{row.status}</Badge>
        </h1>
        <p className="text-sm text-muted-foreground">
          {row.subjectType} · {row.code} · {row.score} · Found {row.found}
        </p>
      </div>
      {lines.decided && <p className="rounded-md border bg-muted/40 p-3 text-sm">{lines.decided}</p>}
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Why it was matched</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {lines.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Listed as {row.listed}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="text-muted-foreground">{row.listing}</p>
            <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-[minmax(0,10rem)_1fr]">
              {lines.listing.map(([label, value]) => (
                <div key={label} className="contents">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      </div>
      {lines.canDecide && (
        <div className="flex flex-wrap gap-2">
          <Button variant="destructive" onClick={() => decide("confirm")}>
            Confirm match
          </Button>
          <Button variant="outline" onClick={() => decide("clear")}>
            Clear as a false positive
          </Button>
        </div>
      )}
      <AmlaNoteDialog
        action={action}
        onClose={() => setAction(null)}
        onDone={() => {
          setAction(null);
          onDecided();
        }}
      />
    </ScrollBox>
  );
}
