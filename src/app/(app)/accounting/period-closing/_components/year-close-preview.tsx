"use client";

import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { NetResult, PreviewBranchView, PreviewLineView, PreviewView } from "../_lib/year-close";

function ResultRow({ result }: { result: NetResult }) {
  return (
    <TableRow className="font-semibold">
      <TableCell>{result.label}</TableCell>
      <TableCell className={cn("text-right tabular-nums", result.loss && "text-destructive")}>
        {result.amount}
      </TableCell>
    </TableRow>
  );
}

function LineRows({ heading, lines, total }: { heading: string; lines: PreviewLineView[]; total: string }) {
  return (
    <>
      <TableRow className="bg-muted/40 hover:bg-muted/40">
        <TableHead scope="rowgroup" colSpan={2} className="text-xs uppercase tracking-wide">
          {heading}
        </TableHead>
      </TableRow>
      {lines.length === 0 ? (
        <TableRow>
          <TableCell colSpan={2} className="text-sm text-muted-foreground">
            No {heading.toLowerCase()} in the year.
          </TableCell>
        </TableRow>
      ) : (
        lines.map((line) => (
          <TableRow key={line.key}>
            <TableCell className="text-sm">{line.account}</TableCell>
            <TableCell className="text-right text-sm tabular-nums">{line.amount}</TableCell>
          </TableRow>
        ))
      )}
      <TableRow>
        <TableCell className="text-sm font-medium">Total {heading.toLowerCase()}</TableCell>
        <TableCell className="text-right text-sm font-medium tabular-nums">{total}</TableCell>
      </TableRow>
    </>
  );
}

function BranchTable({ branch }: { branch: PreviewBranchView }) {
  return (
    <section aria-label={branch.name} className="space-y-2">
      <h4 className="text-sm font-semibold">{branch.name}</h4>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Account</TableHead>
              <TableHead className="w-40 text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <LineRows heading="Income" lines={branch.income} total={branch.totalIncome} />
            <LineRows heading="Expenses" lines={branch.expenses} total={branch.totalExpenses} />
          </TableBody>
          <TableFooter>
            <ResultRow result={branch.result} />
          </TableFooter>
        </Table>
      </div>
    </section>
  );
}

/** The server's preview of a year-end close, figure for figure. */
export function YearClosePreviewPanel({ view }: { view: PreviewView }) {
  return (
    <div className="space-y-5">
      {view.blockingReasons.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>{view.year} can&apos;t be closed yet</AlertTitle>
          <AlertDescription>
            <ul className="list-disc space-y-1 pl-4">
              {view.blockingReasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border p-3">
          <dt className="text-xs text-muted-foreground">Total income</dt>
          <dd className="font-semibold tabular-nums">{view.totalIncome}</dd>
        </div>
        <div className="rounded-lg border p-3">
          <dt className="text-xs text-muted-foreground">Total expenses</dt>
          <dd className="font-semibold tabular-nums">{view.totalExpenses}</dd>
        </div>
        <div className="rounded-lg border p-3">
          <dt className="text-xs text-muted-foreground">{view.result.label}</dt>
          <dd className={cn("font-semibold tabular-nums", view.result.loss && "text-destructive")}>
            {view.result.amount}
          </dd>
        </div>
        <div className="rounded-lg border p-3">
          <dt className="text-xs text-muted-foreground">Dated {view.asOf}</dt>
          <dd className="font-semibold">{view.movesTo}</dd>
        </div>
      </dl>

      {view.branches.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No income or expense was posted in {view.year}, so no closing entry would be posted.
        </p>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {view.branches.map((branch) => (
            <BranchTable key={branch.key} branch={branch} />
          ))}
        </div>
      )}

      <div className="space-y-1 text-sm">
        <p className="font-medium">Months it will close</p>
        <p className="text-muted-foreground">
          {view.monthsToClose.length > 0 ? view.monthsToClose.join(", ") : "—"}
        </p>
      </div>
    </div>
  );
}
