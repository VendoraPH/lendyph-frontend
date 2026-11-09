"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCentavos } from "@/lib/accounting/money";
import { formatDate, formatDateTime } from "@/lib/format";
import type { JournalEntry } from "@/types";
import { JournalReferenceCell } from "../../_components/journal-source-document";
import { journalSourceLabel } from "../../_lib/display-labels";
import { reversedEntryText } from "../_lib/journal-actions";
import { JournalStatusBadge } from "./journal-status-badge";

/** "Name, 3 Nov 2026, 10:15 am", or a dash when nobody is recorded. */
function byLine(name: string | null | undefined, at: string | null | undefined): string {
  if (!name && !at) return "—";
  return [name, at ? formatDateTime(at) : null].filter(Boolean).join(", ");
}

function branchText(entry: JournalEntry): string {
  if (entry.branch_name) return entry.branch_name;
  return entry.branch_id === null ? "No branch" : "—";
}

/** A line's side it doesn't use reads "—"; a zero it does use reads ₱0.00. */
function sideText(amount: number, other: number): string {
  return amount === 0 && other !== 0 ? "—" : formatCentavos(amount);
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

/** One journal as the server sent it: its details, every line and its totals. */
export function JournalDetails({ entry }: { entry: JournalEntry }) {
  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Detail label="Date">{formatDate(entry.date)}</Detail>
            <Detail label="Status">
              <JournalStatusBadge status={entry.status} />
            </Detail>
            <Detail label="Source">{journalSourceLabel(entry.source)}</Detail>
            <Detail label="Branch">{branchText(entry)}</Detail>
            <Detail label="Reference and source document">
              <span className="font-mono text-xs">
                <JournalReferenceCell entry={entry} />
              </span>
            </Detail>
            <Detail label="Created by">{byLine(entry.created_by, entry.created_at)}</Detail>
            <Detail label="Posted by">{byLine(entry.posted_by, entry.posted_at)}</Detail>
            <div className="space-y-1 sm:col-span-2 lg:col-span-4">
              <dt className="text-xs text-muted-foreground">Description</dt>
              <dd className="text-sm whitespace-pre-line">{entry.description || "—"}</dd>
            </div>
          </dl>

          {(entry.reverses_journal_id || entry.reversed_by_journal_id) && (
            <div className="mt-4 space-y-1 rounded-lg border border-orange-500/30 bg-orange-500/5 p-3 text-sm">
              {entry.reverses_journal_id && (
                <p>
                  This entry reverses {reversedEntryText(entry)}.{" "}
                  <Link
                    className="font-medium underline underline-offset-4"
                    href={`/accounting/journals/${entry.reverses_journal_id}`}
                  >
                    Open the original entry
                  </Link>
                </p>
              )}
              {entry.reversed_by_journal_id && (
                <p>
                  This entry has been reversed. It stays in the books, and the reversing entry
                  cancels it out.{" "}
                  <Link
                    className="font-medium underline underline-offset-4"
                    href={`/accounting/journals/${entry.reversed_by_journal_id}`}
                  >
                    Open the reversing entry
                  </Link>
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="overflow-x-auto pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Code</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Line description</TableHead>
                <TableHead className="w-36 text-right">Debit</TableHead>
                <TableHead className="w-36 text-right">Credit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entry.lines.map((line, i) => (
                <TableRow key={line.id ?? i}>
                  <TableCell className="font-mono text-xs">{line.account_code ?? "—"}</TableCell>
                  <TableCell className="text-sm">{line.account_name ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {line.description || "—"}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {sideText(line.debit, line.credit)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {sideText(line.credit, line.debit)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={3} className="font-semibold">
                  Total
                </TableCell>
                <TableCell className="text-right font-mono font-semibold">
                  {formatCentavos(entry.total_debit)}
                </TableCell>
                <TableCell className="text-right font-mono font-semibold">
                  {formatCentavos(entry.total_credit)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
