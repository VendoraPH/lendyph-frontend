"use client";

import { useCallback, type ReactNode } from "react";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import { useAccountingResource } from "@/hooks";
import { accountingService } from "@/services";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ColumnBook, ColumnBookKind } from "@/types";
import { DataState } from "../../_components/data-state";
import {
  balanceBadge,
  columnBookFooter,
  columnBookHeads,
  columnBookNote,
  columnBookRowCells,
  sideLabels,
} from "../_lib/column-book";

interface ColumnBookReportProps {
  kind: ColumnBookKind;
  from: string;
  to: string;
  branchId?: number;
  /** What this book is for, in the operator's words. */
  summary: string;
  endpoint: string;
}

/**
 * A cash book in the columnar form: one column per money account, one per
 * mapped account, then Sundry for everything else. Every figure, totals
 * included, is the server's.
 */
export function ColumnBookReport({
  kind,
  from,
  to,
  branchId,
  summary,
  endpoint,
}: ColumnBookReportProps) {
  const fetcher = useCallback(
    () => accountingService.columnBook(kind, { from, to, branch_id: branchId }),
    [kind, from, to, branchId],
  );
  const resource = useAccountingResource<ColumnBook>(fetcher);

  return (
    <DataState
      resource={resource}
      summary={summary}
      endpoints={[endpoint]}
      isEmpty={(book) => book.rows.length === 0}
      emptyMessage="Nothing recorded in this book for the chosen dates."
    >
      {(book) => <ColumnBookCard book={book} />}
    </DataState>
  );
}

const amount = "whitespace-nowrap text-right font-mono text-sm";
const groupStart = "border-l";

/** One sundry value per line, so a journal's sundry lines stay side by side across the three cells. */
function Stacked({ lines }: { lines: Array<{ key: string; value: ReactNode }> }) {
  return (
    <div className="space-y-1">
      {lines.map((line) => (
        <div key={line.key} className="min-h-5">
          {line.value}
        </div>
      ))}
    </div>
  );
}

function ColumnBookCard({ book }: { book: ColumnBook }) {
  const heads = columnBookHeads(book);
  const sides = sideLabels(book.kind);
  const footer = columnBookFooter(book);
  const badge = balanceBadge(book);
  const hasMoney = heads.money.length > 0;
  const hasColumns = heads.columns.length > 0;

  return (
    <Card className="min-w-0">
      <CardContent className="space-y-4 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            {formatDate(book.from)} to {formatDate(book.to)} · {book.rows.length}{" "}
            {book.rows.length === 1 ? "entry" : "entries"}
          </p>
          <Badge
            variant={badge.balanced ? "outline" : "destructive"}
            className={cn(
              badge.balanced && "border-emerald-500/40 text-emerald-700 dark:text-emerald-400",
            )}
          >
            {badge.balanced ? (
              <CheckCircle2 aria-hidden="true" />
            ) : (
              <AlertTriangle aria-hidden="true" />
            )}
            {badge.label}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">{columnBookNote(book.kind)}</p>

        <Table>
          <caption className="sr-only">
            {book.kind === "cash_receipts" ? "Cash Receipts" : "Cash Disbursements"} in columns,{" "}
            {formatDate(book.from)} to {formatDate(book.to)}
          </caption>
          <TableHeader>
            <TableRow>
              <TableHead rowSpan={2} scope="col" className="w-28 align-bottom">
                Date
              </TableHead>
              <TableHead rowSpan={2} scope="col" className="w-32 align-bottom">
                Entry no.
              </TableHead>
              <TableHead rowSpan={2} scope="col" className="w-32 align-bottom">
                Reference
              </TableHead>
              <TableHead rowSpan={2} scope="col" className="min-w-48 align-bottom">
                Particulars
              </TableHead>
              {hasMoney && (
                <TableHead colSpan={heads.money.length} scope="colgroup" className={cn("text-center", groupStart)}>
                  Cash and bank ({sides.money})
                </TableHead>
              )}
              {hasColumns && (
                <TableHead colSpan={heads.columns.length} scope="colgroup" className={cn("text-center", groupStart)}>
                  {sides.columns === "Cr" ? "Credits" : "Debits"} ({sides.columns})
                </TableHead>
              )}
              <TableHead colSpan={3} scope="colgroup" className={cn("text-center", groupStart)}>
                Sundry
              </TableHead>
            </TableRow>
            <TableRow>
              {heads.money.map((head, i) => (
                <TableHead key={head.key} scope="col" className={cn("min-w-32 whitespace-normal text-right", i === 0 && groupStart)}>
                  {head.label}
                </TableHead>
              ))}
              {heads.columns.map((head, i) => (
                <TableHead key={head.key} scope="col" className={cn("min-w-32 whitespace-normal text-right", i === 0 && groupStart)}>
                  {head.label}
                </TableHead>
              ))}
              <TableHead scope="col" className={cn("min-w-48", groupStart)}>
                Account
              </TableHead>
              <TableHead scope="col" className="w-32 text-right">
                Debit
              </TableHead>
              <TableHead scope="col" className="w-32 text-right">
                Credit
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {book.rows.map((row) => {
              const cells = columnBookRowCells(book, row);
              return (
                <TableRow key={cells.key} className="align-top">
                  <TableCell className="whitespace-nowrap text-sm">{formatDate(cells.date)}</TableCell>
                  <TableCell className="font-mono text-xs">{cells.journalNo}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{cells.reference}</TableCell>
                  <TableCell className="whitespace-normal text-sm">{cells.particulars}</TableCell>
                  {cells.money.map((text, i) => (
                    <TableCell key={heads.money[i].key} className={cn(amount, i === 0 && groupStart)}>
                      {text}
                    </TableCell>
                  ))}
                  {cells.columns.map((text, i) => (
                    <TableCell key={heads.columns[i].key} className={cn(amount, i === 0 && groupStart)}>
                      {text}
                    </TableCell>
                  ))}
                  <TableCell className={cn("whitespace-normal text-sm text-muted-foreground", groupStart)}>
                    <Stacked lines={cells.sundry.map((line) => ({ key: line.key, value: line.account }))} />
                  </TableCell>
                  <TableCell className={amount}>
                    <Stacked lines={cells.sundry.map((line) => ({ key: line.key, value: line.debit }))} />
                  </TableCell>
                  <TableCell className={amount}>
                    <Stacked lines={cells.sundry.map((line) => ({ key: line.key, value: line.credit }))} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={4} className="font-semibold">
                Total
              </TableCell>
              {footer.money.map((text, i) => (
                <TableCell key={heads.money[i].key} className={cn(amount, "font-semibold", i === 0 && groupStart)}>
                  {text}
                </TableCell>
              ))}
              {footer.columns.map((text, i) => (
                <TableCell key={heads.columns[i].key} className={cn(amount, "font-semibold", i === 0 && groupStart)}>
                  {text}
                </TableCell>
              ))}
              <TableCell className={groupStart} />
              <TableCell className={cn(amount, "font-semibold")}>{footer.sundryDebit}</TableCell>
              <TableCell className={cn(amount, "font-semibold")}>{footer.sundryCredit}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell colSpan={4} className="font-semibold">
                Book total
              </TableCell>
              {hasMoney && <TableCell colSpan={heads.money.length} className={groupStart} />}
              {hasColumns && <TableCell colSpan={heads.columns.length} className={groupStart} />}
              <TableCell className={cn("whitespace-normal text-sm text-muted-foreground", groupStart)}>
                Every line, as in the Lines view
              </TableCell>
              <TableCell className={cn(amount, "font-semibold")}>{footer.bookDebit}</TableCell>
              <TableCell className={cn(amount, "font-semibold")}>{footer.bookCredit}</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </CardContent>
    </Card>
  );
}
