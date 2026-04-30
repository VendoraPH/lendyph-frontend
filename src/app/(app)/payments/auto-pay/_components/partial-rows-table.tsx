"use client";

import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/format";
import type { AutoPayPartialRow } from "@/types";

interface PartialRowsTableProps {
  rows: AutoPayPartialRow[];
  includedIds: Set<number>;
  onToggle: (scheduleId: number, included: boolean) => void;
}

export function PartialRowsTable({
  rows,
  includedIds,
  onToggle,
}: PartialRowsTableProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20">
      <div className="border-b border-amber-200 px-4 py-3 dark:border-amber-800">
        <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
          ⚠ Partial Payments — Review Required ({rows.length})
        </p>
        <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-300">
          These loans have partially-paid dues in the selected range. Decide
          whether to include or skip each one.
        </p>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">Include</TableHead>
              <TableHead>Borrower</TableHead>
              <TableHead>Loan Account</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead>Period</TableHead>
              <TableHead className="text-right">Remaining</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.schedule_id}>
                <TableCell>
                  <Checkbox
                    checked={includedIds.has(row.schedule_id)}
                    onCheckedChange={(v) =>
                      onToggle(row.schedule_id, Boolean(v))
                    }
                    aria-label={`Include ${row.borrower_name} – ${row.loan_account}`}
                  />
                </TableCell>
                <TableCell className="font-medium">
                  {row.borrower_name}
                </TableCell>
                <TableCell className="font-mono text-sm">
                  {row.loan_account}
                </TableCell>
                <TableCell>{formatDate(row.due_date)}</TableCell>
                <TableCell className="text-muted-foreground">
                  #{row.period_number}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(row.remaining_balance)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
