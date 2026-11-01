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
import { formatCurrency } from "@/lib/format";
import type { AutoPayLoanRow } from "@/types";
import type { PreviewTotals } from "../_lib/auto-pay-view";

interface DueLoansTableProps {
  loans: AutoPayLoanRow[];
  totals: PreviewTotals;
}

/** Loans with full dues in the window, and the server's figures for each. */
export function DueLoansTable({ loans, totals }: DueLoansTableProps) {
  if (loans.length === 0) return null;
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Loan Account</TableHead>
            <TableHead>Borrower</TableHead>
            <TableHead className="text-right">Principal</TableHead>
            <TableHead className="text-right">Interest</TableHead>
            <TableHead className="text-right">Penalty</TableHead>
            <TableHead className="text-right">Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loans.map((loan) => (
            <TableRow key={loan.loan_id}>
              <TableCell className="font-mono text-sm">
                {loan.loan_account_number ?? `Loan #${loan.loan_id}`}
              </TableCell>
              <TableCell className="font-medium">{loan.borrower_name}</TableCell>
              <TableCell className="text-right tabular-nums">{formatCurrency(loan.total_principal)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatCurrency(loan.total_interest)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatCurrency(loan.total_penalty)}</TableCell>
              <TableCell className="text-right font-medium tabular-nums">{formatCurrency(loan.total_amount)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow className="font-semibold">
            <TableCell colSpan={2}>Total</TableCell>
            <TableCell className="text-right tabular-nums">{formatCurrency(totals.principal)}</TableCell>
            <TableCell className="text-right tabular-nums">{formatCurrency(totals.interest)}</TableCell>
            <TableCell className="text-right tabular-nums">
              {totals.penalty === null ? "—" : formatCurrency(totals.penalty)}
            </TableCell>
            <TableCell className="text-right tabular-nums">{formatCurrency(totals.amount)}</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  );
}
