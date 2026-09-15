"use client";

/**
 * The rows the pre-check has something to say about.
 *
 * The load-bearing rule here is that the HEADING is the truth and the TABLE is
 * a window onto it. Three different numbers are in play and every one of them
 * has been quietly conflated on some screen in this codebase before:
 *
 *   - how many problems exist        — exact, always, from the complete pass
 *   - how many are in this list      — capped, so a 50,000-row disaster does
 *                                      not build 200,000 DOM-bound objects
 *   - how many are on this page      — `TablePagination`'s job
 *
 * A count taken from `issues.length` is the second number wearing the first
 * one's label, and it always reads lower. Every count rendered below comes from
 * `errorCount`/`warningCount`, which `checkRows` keeps exact even after it
 * stops collecting examples.
 *
 * Errors and warnings are counted separately and are never added together: the
 * server repairs a contact number holding two values and matches loans to
 * members who already exist, so those rows import. A single "problems" total
 * would send an admin to hand-fix data that was never broken.
 */

import { useMemo, useState } from "react";
import { AlertTriangle, CircleAlert, ListChecks } from "lucide-react";
import { TablePagination } from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCount } from "@/lib/report-format";
import { cn } from "@/lib/utils";
import type { PrecheckIssue } from "../_hooks/use-file-precheck";

type SeverityFilter = "all" | "error" | "warning";

export interface PrecheckErrorsTableProps {
  /** Names the file these rows came from, for the heading. */
  fileLabel: string;
  /** The capped list of examples. Never the source of a count. */
  issues: readonly PrecheckIssue[];
  /** Exact over every checked row, even when `issues` is capped. */
  errorCount: number;
  /** Exact over every checked row. Never folded into `errorCount`. */
  warningCount: number;
  /** True when `issues` stopped collecting before the counts did. */
  issuesTruncated: boolean;
}

const DEFAULT_PER_PAGE = 20;

function SeverityBadge({ severity }: { severity: PrecheckIssue["severity"] }) {
  return severity === "error" ? (
    <Badge variant="destructive" className="gap-1">
      <CircleAlert aria-hidden="true" />
      Will fail
    </Badge>
  ) : (
    <Badge variant="outline" className="gap-1 border-amber-500/50 text-amber-700 dark:text-amber-300">
      <AlertTriangle aria-hidden="true" />
      Imports
    </Badge>
  );
}

export function PrecheckErrorsTable({
  fileLabel,
  issues,
  errorCount,
  warningCount,
  issuesTruncated,
}: PrecheckErrorsTableProps) {
  const [filter, setFilter] = useState<SeverityFilter>("all");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(DEFAULT_PER_PAGE);

  const filtered = useMemo(
    () => (filter === "all" ? issues : issues.filter((issue) => issue.severity === filter)),
    [issues, filter],
  );

  // Narrowing the filter can leave fewer pages than the one you are on, so
  // both controls reset the page as they change it. `safePage` below clamps
  // everything else — including a fresh `issues` array from a re-check — which
  // is why this needs no effect.
  const changeFilter = (next: SeverityFilter) => {
    setFilter(next);
    setPage(1);
  };
  const changePerPage = (next: number) => {
    setPerPage(next);
    setPage(1);
  };

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * perPage;
  const shown = filtered.slice(start, start + perPage);

  if (errorCount === 0 && warningCount === 0) return null;

  const exactTotal = errorCount + warningCount;
  const filters: Array<{ key: SeverityFilter; label: string; count: number }> = [
    { key: "all", label: "All", count: exactTotal },
    { key: "error", label: "Will fail", count: errorCount },
    { key: "warning", label: "Imports anyway", count: warningCount },
  ];

  return (
    <section className="rounded-lg border p-4" aria-labelledby={`issues-${fileLabel}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id={`issues-${fileLabel}`} className="flex items-center gap-2 text-sm font-semibold">
            <ListChecks className="size-4 text-muted-foreground" aria-hidden="true" />
            {fileLabel} — {formatCount(exactTotal)} {exactTotal === 1 ? "note" : "notes"} on your rows
          </h3>
          {/* The two totals stay apart. Adding them would put a repairable
              value inside a failure count. */}
          <p className="mt-1 text-xs text-muted-foreground">
            {formatCount(errorCount)} will stop a row importing,{" "}
            {formatCount(warningCount)} will not.
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by outcome">
          {filters.map((option) => (
            <Button
              key={option.key}
              type="button"
              size="sm"
              variant={filter === option.key ? "default" : "outline"}
              aria-pressed={filter === option.key}
              onClick={() => changeFilter(option.key)}
            >
              {option.label}
              <span className={cn("ml-1.5 tabular-nums", filter !== option.key && "text-muted-foreground")}>
                {formatCount(option.count)}
              </span>
            </Button>
          ))}
        </div>
      </div>

      {issuesTruncated && (
        <p
          role="alert"
          className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden="true" />
          <span>
            The counts above are complete, but only the first {formatCount(issues.length)} examples
            are listed. Fix these, re-export, and run the check again to see the rest — or import and
            use the error report, which is generated from every row on the server.
          </span>
        </p>
      )}

      <div className="mt-3 overflow-x-auto">
        {/* A floor rather than `w-full` alone: below this the message column
            squeezes to one word per line and the table stops being readable.
            Scrolling sideways on a phone is the lesser evil. */}
        <Table className="min-w-[46rem]">
          <TableCaption className="text-left">
            {total === 0
              ? "No rows match this filter."
              : `Showing ${formatCount(start + 1)}–${formatCount(
                  Math.min(start + perPage, total),
                )} of ${formatCount(total)} listed ${total === 1 ? "note" : "notes"}${
                  issuesTruncated ? ` (${formatCount(exactTotal)} found in total)` : ""
                }.`}
          </TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">Line</TableHead>
              <TableHead className="w-36">Record</TableHead>
              <TableHead className="w-44">Column</TableHead>
              <TableHead>What is wrong</TableHead>
              <TableHead className="w-28 text-right">Outcome</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((issue) => (
              <TableRow key={issue.id}>
                <TableCell className="tabular-nums text-muted-foreground">{issue.line}</TableCell>
                <TableCell className="font-mono text-xs">{issue.reference || "—"}</TableCell>
                {/* `TableCell` defaults to `whitespace-nowrap`; these two hold
                    sentences, and without this the table is wider than any
                    screen and the message is the part that gets clipped. */}
                <TableCell className="text-xs whitespace-normal">
                  {issue.column ?? "Whole row"}
                </TableCell>
                <TableCell className="text-sm whitespace-normal">{issue.message}</TableCell>
                <TableCell className="text-right">
                  <SeverityBadge severity={issue.severity} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <TablePagination
        page={safePage}
        perPage={perPage}
        total={total}
        onPageChange={setPage}
        onPerPageChange={changePerPage}
      />
    </section>
  );
}
