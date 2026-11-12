"use client";

import { useCallback } from "react";
import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { accountingService } from "@/services";
import type { StatementNotes } from "@/types/cda";
import { pesosNote } from "../_lib/statement-notes";
import { StatementState } from "./statement-state";
import { useStatementResource } from "./use-statement-resource";

/**
 * The notes to the financial statements: the year's Enhanced PESOS rating,
 * which CDA asks the notes to quote. The figures are the server's: the
 * finalized PESOS report's frozen score and rating, else the live result
 * marked provisional. Render it only for users who may read it
 * (`canSeeStatementNotes`), so nothing is asked of the server otherwise.
 */
export function StatementNotesReport({ year }: { year: number }) {
  const fetcher = useCallback(() => accountingService.statementNotes(year), [year]);
  const { resource, refusal } = useStatementResource<StatementNotes>(fetcher);

  return (
    <StatementState
      resource={resource}
      refusal={refusal}
      summary="The year's Enhanced PESOS rating, as the notes to the financial statements quote it."
      endpoints={["GET /accounting/statements/notes"]}
    >
      {({ pesos }) => {
        const note = pesosNote(pesos);
        return (
          <Card>
            <CardHeader>
              <CardTitle>Enhanced PESOS rating, {pesos.year}</CardTitle>
              <CardDescription>
                {note.inUse
                  ? "From the CDA PESOS report: its finalized figures once it is finalized, else today's result."
                  : `No CDA reporting period is open for ${pesos.year}, so there is no rating to quote.`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <dl className="grid gap-4 sm:grid-cols-3">
                <div>
                  <dt className="text-sm text-muted-foreground">Score</dt>
                  <dd className="text-lg font-semibold tabular-nums">{note.score}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Rating</dt>
                  <dd className="text-lg font-semibold">{note.rating}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Status</dt>
                  <dd className="pt-1">
                    {note.status === "—" ? (
                      <span className="text-lg font-semibold">—</span>
                    ) : (
                      <Badge variant={pesos.provisional ? "outline" : "secondary"}>{note.status}</Badge>
                    )}
                  </dd>
                </div>
              </dl>
              {note.toVerify && (
                <div role="note" className="flex gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                  <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  <div className="space-y-1">
                    <p className="font-medium">{note.toVerify}</p>
                    {note.disclosure && <p className="text-muted-foreground">{note.disclosure}</p>}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      }}
    </StatementState>
  );
}
