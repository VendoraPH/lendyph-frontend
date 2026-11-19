"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { amlaTransactionRow } from "@/lib/amla/monitoring-view";
import type { AmlaMonitoredTransaction } from "@/types/amla-monitoring";

/** The transactions behind an alert or a CTR candidate, as the server sends them: amounts in ₱ words, reversals marked. */
export function TransactionsTable({ transactions }: { transactions: AmlaMonitoredTransaction[] }) {
  if (transactions.length === 0) return <p className="text-sm text-muted-foreground">No transactions are linked.</p>;
  return (
    <Table className="min-w-[44rem]">
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Transaction</TableHead>
          <TableHead>Channel</TableHead>
          <TableHead>Reference</TableHead>
          <TableHead>Branch</TableHead>
          <TableHead className="text-right">Amount</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {transactions.map(amlaTransactionRow).map((row) => (
          <TableRow key={row.id}>
            <TableCell>{row.date}</TableCell>
            <TableCell className="whitespace-normal">
              {row.kind} · {row.direction}
              {row.notes.map((note) => (
                <div key={note} className="text-xs text-muted-foreground">
                  {note}
                </div>
              ))}
            </TableCell>
            <TableCell>{row.channel}</TableCell>
            <TableCell className="whitespace-nowrap">{row.reference}</TableCell>
            <TableCell>{row.branch}</TableCell>
            <TableCell className="text-right whitespace-nowrap">{row.amount}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
