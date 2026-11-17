"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { bookRows as booksOnly, rowMatchAction } from "../_lib/line-actions";
import { journalHref, ledgerLineText, rowFigures } from "../_lib/reconciliation-view";
import { signedCentavos } from "../_lib/signed-money";
import { FigureWithNote } from "./figure-with-note";
import type { ReconciliationDetail, ReconciliationRow } from "../_lib/types";
import { MatchBadge } from "./match-badge";

interface WorksheetTableProps {
  reconciliation: ReconciliationDetail;
  busy: boolean;
  onConfirm: (row: ReconciliationRow) => void;
  onUnmatch: (row: ReconciliationRow) => void;
  onResolve: (row: ReconciliationRow) => void;
}

/** The statement's lines with their status and ledger line, then the books' lines nothing claims. */
export function WorksheetTable({ reconciliation, busy, onConfirm, onUnmatch, onResolve }: WorksheetTableProps) {
  const statementRows = reconciliation.lines.filter((row) => row.statement_line_id !== null);
  const bookRows = booksOnly(reconciliation.lines);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Statement lines</CardTitle>
        </CardHeader>
        <CardContent>
          {statementRows.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No statement lines were recorded for this reconciliation.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28">Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-32">Reference</TableHead>
                  <TableHead className="w-32 text-right">Amount</TableHead>
                  <TableHead className="w-36">Status</TableHead>
                  <TableHead className="w-44">Ledger line</TableHead>
                  <TableHead className="w-36 text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {statementRows.map((row) => {
                  const figures = rowFigures(row);
                  return (
                    <TableRow key={`s${row.statement_line_id}`}>
                      <TableCell className="text-sm">
                        <FigureWithNote figure={figures.date} note={figures.dateNote} />
                      </TableCell>
                      <TableCell className="text-sm">{row.description}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {row.external_reference || "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        <FigureWithNote figure={figures.amount} note={figures.amountNote} />
                      </TableCell>
                      <TableCell>
                        <MatchBadge match={row.match} />
                      </TableCell>
                      <TableCell className="text-sm">
                        <LedgerLine row={row} />
                      </TableCell>
                      <TableCell className="text-right">
                        <RowAction
                          row={row}
                          busy={busy}
                          onConfirm={onConfirm}
                          onUnmatch={onUnmatch}
                          onResolve={onResolve}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {bookRows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">In the books, not on the statement</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28">Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-36">Journal</TableHead>
                  <TableHead className="w-32">Reference</TableHead>
                  <TableHead className="w-32 text-right">Amount</TableHead>
                  <TableHead className="w-48">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bookRows.map((row) => (
                  <TableRow key={`l${row.journal_line_id}`}>
                    <TableCell className="text-sm">{formatDate(row.date)}</TableCell>
                    <TableCell className="text-sm">{row.description}</TableCell>
                    <TableCell className="text-sm">
                      {row.journal_id !== null ? (
                        <Link className="underline underline-offset-2" href={journalHref(row.journal_id)}>
                          {row.journal_no ?? "Open journal"}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {row.external_reference || "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">{signedCentavos(row.amount)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{ledgerLineText(row)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}


function LedgerLine({ row }: { row: ReconciliationRow }) {
  const text = ledgerLineText(row);
  if (row.source !== "both" || row.journal_id === null) {
    return <span className="text-muted-foreground">{text}</span>;
  }
  return (
    <Link className="underline underline-offset-2" href={journalHref(row.journal_id)}>
      {text}
    </Link>
  );
}

function RowAction({
  row,
  busy,
  onConfirm,
  onUnmatch,
  onResolve,
}: Omit<WorksheetTableProps, "reconciliation"> & { row: ReconciliationRow }) {
  switch (rowMatchAction(row)) {
    case "confirm":
      return (
        <Button size="sm" variant="outline" disabled={busy} onClick={() => onConfirm(row)}>
          Confirm match
        </Button>
      );
    case "unmatch":
      return (
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => onUnmatch(row)}>
          Unmatch
        </Button>
      );
    case "match":
      return (
        <Button size="sm" disabled={busy} onClick={() => onResolve(row)}>
          Resolve…
        </Button>
      );
    default:
      return null;
  }
}
