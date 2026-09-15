"use client";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LOAN_STATUS_COLORS, LOAN_STATUS_LABELS } from "@/constants";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Loan } from "@/types";
import { Check } from "lucide-react";

/**
 * One member's loans, one of them chosen.
 *
 * Presentational on purpose — every fetch, filter and selection decision lives
 * in `loan-subject-picker.tsx`, which is the only thing that renders this.
 */

/** The loan's account number, falling back the way the rest of the app does. */
export function loanNumber(loan: Loan): string {
  return (
    loan.loan_account_number ?? loan.application_number ?? `Loan #${loan.id}`
  );
}

/**
 * The day the money went out. `released_at` is the current field; `release_date`
 * is the legacy alias older responses still carry, so both are read before the
 * row admits it doesn't know.
 */
function releasedOn(loan: Loan): string {
  const released = loan.released_at ?? loan.release_date;
  return released ? formatDate(released) : "—";
}

interface BorrowerLoansTableProps {
  loans: Loan[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}

export function BorrowerLoansTable({
  loans,
  selectedId,
  onSelect,
}: BorrowerLoansTableProps) {
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="w-10" />
            <TableHead className="text-xs">Loan Number</TableHead>
            <TableHead className="text-xs">Product</TableHead>
            <TableHead className="text-xs text-right">Loan Amount</TableHead>
            <TableHead className="text-xs text-right">Outstanding</TableHead>
            <TableHead className="text-xs">Date Released</TableHead>
            <TableHead className="text-xs">Maturity</TableHead>
            <TableHead className="text-xs text-right">Term</TableHead>
            <TableHead className="text-xs">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loans.map((loan) => {
            const selected = loan.id === selectedId;
            return (
              <TableRow
                key={loan.id}
                // Selection is what this table is for, so the whole row is the
                // target. `aria-selected` and the tab stop are what make that
                // reachable without a mouse — a bare `onClick` on a `<tr>` is
                // invisible to the keyboard.
                aria-selected={selected}
                tabIndex={0}
                onClick={() => onSelect(loan.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelect(loan.id);
                  }
                }}
                className={cn(
                  "cursor-pointer transition-colors",
                  selected && "bg-brand-orange/10 hover:bg-brand-orange/15"
                )}
              >
                <TableCell className="w-10">
                  <span
                    className={cn(
                      "flex h-4 w-4 items-center justify-center rounded-full border",
                      selected
                        ? "border-brand-orange bg-brand-orange text-brand-orange-foreground"
                        : "border-muted-foreground/40"
                    )}
                    aria-hidden="true"
                  >
                    {selected && <Check className="h-3 w-3" />}
                  </span>
                </TableCell>
                <TableCell className="text-sm font-medium">
                  {loanNumber(loan)}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {loan.loan_product?.name ?? loan.loan_product_name ?? "—"}
                </TableCell>
                <TableCell className="text-sm text-right tabular-nums">
                  {formatCurrency(loan.principal_amount)}
                </TableCell>
                <TableCell className="text-sm text-right tabular-nums">
                  {loan.outstanding_balance !== undefined
                    ? formatCurrency(loan.outstanding_balance)
                    : "—"}
                </TableCell>
                <TableCell className="text-sm">{releasedOn(loan)}</TableCell>
                <TableCell className="text-sm">
                  {loan.maturity_date ? formatDate(loan.maturity_date) : "—"}
                </TableCell>
                <TableCell className="text-sm text-right tabular-nums">
                  {loan.term ?? loan.term_months ?? "—"}
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={cn("text-xs", LOAN_STATUS_COLORS[loan.status])}
                  >
                    {LOAN_STATUS_LABELS[loan.status] ?? loan.status}
                  </Badge>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
