"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { formatCurrency, formatDate } from "@/lib/format";
import { sumBinhsRows, type BinhsRow } from "@/lib/binhs";

interface Props {
  rows: BinhsRow[];
  paidFlags?: boolean[];
  onTogglePaid?: (index: number, paid: boolean) => void;
  emptyMessage?: string;
}

export function BinhsScheduleTable({
  rows,
  paidFlags,
  onTogglePaid,
  emptyMessage = "Enter valid inputs to compute the schedule.",
}: Props) {
  const showPaidColumn = !!onTogglePaid;
  const totals = sumBinhsRows(rows);
  const colSpan = showPaidColumn ? 9 : 8;

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            {showPaidColumn && <TableHead className="w-[60px]">Paid?</TableHead>}
            <TableHead className="w-[60px]">#</TableHead>
            <TableHead>Due Date</TableHead>
            <TableHead className="text-right">Principal</TableHead>
            <TableHead className="text-right">Interest</TableHead>
            <TableHead className="text-right">Penalty</TableHead>
            <TableHead className="text-right">SCBU</TableHead>
            <TableHead className="text-right">Total Payment</TableHead>
            <TableHead className="text-right">Running Balance</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={colSpan}
                className="text-center text-muted-foreground py-8"
              >
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((r, idx) => (
              <TableRow key={r.period}>
                {showPaidColumn && (
                  <TableCell>
                    <Checkbox
                      checked={paidFlags?.[idx] ?? false}
                      onCheckedChange={(c) =>
                        onTogglePaid?.(idx, c === true)
                      }
                      aria-label={`Mark period ${r.period} paid`}
                    />
                  </TableCell>
                )}
                <TableCell>{r.period}</TableCell>
                <TableCell>{formatDate(r.dueDate)}</TableCell>
                <TableCell className="text-right">
                  {formatCurrency(r.principal)}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(r.interest)}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(r.penalty)}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(r.scbu)}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(r.totalPayment)}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(r.runningBalance)}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
        {rows.length > 0 && (
          <TableFooter>
            <TableRow>
              {showPaidColumn && <TableCell />}
              <TableCell colSpan={2} className="font-semibold">
                Totals
              </TableCell>
              <TableCell className="text-right font-semibold">
                {formatCurrency(totals.principal)}
              </TableCell>
              <TableCell className="text-right font-semibold">
                {formatCurrency(totals.interest)}
              </TableCell>
              <TableCell className="text-right font-semibold">
                {formatCurrency(totals.penalty)}
              </TableCell>
              <TableCell className="text-right font-semibold">
                {formatCurrency(totals.scbu)}
              </TableCell>
              <TableCell className="text-right font-semibold">
                {formatCurrency(totals.totalPayment)}
              </TableCell>
              <TableCell />
            </TableRow>
          </TableFooter>
        )}
      </Table>
    </div>
  );
}
