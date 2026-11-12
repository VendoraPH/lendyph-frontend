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
import { displayBinhsScenario, type BinhsScenario } from "@/lib/binhs";

interface Props {
  /** The server's scenario; null while there is none to show. */
  scenario: BinhsScenario | null;
  paidFlags?: boolean[];
  onTogglePaid?: (index: number, paid: boolean) => void;
  emptyMessage: string;
  /** A newer answer is on its way; the rows shown are the last one's. */
  busy?: boolean;
}

/** One BINHS schedule, its rows and totals exactly as the server sent them. */
export function BinhsScheduleTable({ scenario, paidFlags, onTogglePaid, emptyMessage, busy }: Props) {
  const showPaidColumn = !!onTogglePaid;
  const { rows, totals } = displayBinhsScenario(scenario);
  const colSpan = showPaidColumn ? 9 : 8;

  return (
    <div className="rounded-md border" aria-busy={busy || undefined}>
      <Table className={busy ? "opacity-60 transition-opacity" : undefined}>
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
              <TableCell colSpan={colSpan} className="py-8 text-center text-muted-foreground">
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
                      onCheckedChange={(c) => onTogglePaid?.(idx, c === true)}
                      aria-label={`Mark period ${r.period} paid`}
                    />
                  </TableCell>
                )}
                <TableCell>{r.period}</TableCell>
                <TableCell>{r.dueDate}</TableCell>
                <TableCell className="text-right">{r.principal}</TableCell>
                <TableCell className="text-right">{r.interest}</TableCell>
                <TableCell className="text-right">{r.penalty}</TableCell>
                <TableCell className="text-right">{r.scbu}</TableCell>
                <TableCell className="text-right font-medium">{r.totalPayment}</TableCell>
                <TableCell className="text-right">{r.runningBalance}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
        {totals && rows.length > 0 && (
          <TableFooter>
            <TableRow>
              {showPaidColumn && <TableCell />}
              <TableCell colSpan={2} className="font-semibold">
                Totals
              </TableCell>
              <TableCell className="text-right font-semibold">{totals.principal}</TableCell>
              <TableCell className="text-right font-semibold">{totals.interest}</TableCell>
              <TableCell className="text-right font-semibold">{totals.penalty}</TableCell>
              <TableCell className="text-right font-semibold">{totals.scbu}</TableCell>
              <TableCell className="text-right font-semibold">{totals.totalPayment}</TableCell>
              <TableCell />
            </TableRow>
          </TableFooter>
        )}
      </Table>
    </div>
  );
}
