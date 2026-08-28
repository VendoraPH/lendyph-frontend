"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowDown, ArrowUp, ArrowUpDown, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  LOAN_STATUS_COLORS,
  LOAN_STATUS_LABELS,
  PAYMENT_FREQUENCY_LABELS,
} from "@/constants";
import type { Loan } from "@/types/loan";
import {
  loanBorrowerName,
  loanProductName,
  loanTerm,
  type LoanSortKey,
  type SortDir,
} from "./utils";

export interface LoanTableProps {
  loans: Loan[];
  sort: { key: LoanSortKey; dir: SortDir };
  onSortChange: (key: LoanSortKey) => void;
  onRowClick: (id: number) => void;
  onAutoPayClick: (loan: Loan) => void;
}

interface ColumnDef {
  key: LoanSortKey;
  label: string;
  align?: "left" | "right";
}

const COLUMNS: ColumnDef[] = [
  { key: "application_number", label: "Application #" },
  { key: "borrower", label: "Member" },
  { key: "product", label: "Product" },
  { key: "amount", label: "Amount", align: "right" },
  { key: "term", label: "Term" },
  { key: "status", label: "Status" },
  { key: "created_at", label: "Date" },
];

export function LoanTable({
  loans,
  sort,
  onSortChange,
  onRowClick,
  onAutoPayClick,
}: LoanTableProps) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {COLUMNS.map((col) => {
              const isActive = sort.key === col.key;
              const Icon = !isActive
                ? ArrowUpDown
                : sort.dir === "asc"
                  ? ArrowUp
                  : ArrowDown;
              return (
                <TableHead
                  key={col.key}
                  className={cn(col.align === "right" && "text-right")}
                  aria-sort={isActive ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
                >
                  <button
                    type="button"
                    onClick={() => onSortChange(col.key)}
                    className={cn(
                      "inline-flex items-center gap-1.5 hover:text-foreground transition-colors",
                      col.align === "right" && "ml-auto",
                      isActive ? "text-foreground" : "text-muted-foreground",
                    )}
                    aria-label={`Sort by ${col.label}`}
                  >
                    {col.label}
                    <Icon className="h-3.5 w-3.5" />
                  </button>
                </TableHead>
              );
            })}
            <TableHead>Auto-Pay</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loans.map((loan) => (
            <TableRow
              key={loan.id}
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => onRowClick(loan.id)}
            >
              <TableCell className="font-mono text-sm">
                {loan.application_number}
              </TableCell>
              <TableCell className="font-medium">
                {loanBorrowerName(loan) || "—"}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {loanProductName(loan) || "—"}
              </TableCell>
              <TableCell className="text-right font-medium">
                {formatCurrency(loan.principal_amount)}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {loanTerm(loan) ?? 0}mo /{" "}
                {(PAYMENT_FREQUENCY_LABELS[
                  (loan.frequency ?? loan.payment_frequency ?? "") as keyof typeof PAYMENT_FREQUENCY_LABELS
                ] ??
                  loan.frequency ??
                  loan.payment_frequency) ||
                  "—"}
              </TableCell>
              <TableCell>
                <Badge variant="outline" className={LOAN_STATUS_COLORS[loan.status]}>
                  {loan.is_restructure && loan.status !== "restructured"
                    ? `Restructured — ${LOAN_STATUS_LABELS[loan.status] ?? loan.status}`
                    : (LOAN_STATUS_LABELS[loan.status] ?? loan.status)}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatDate(loan.created_at)}
              </TableCell>
              <TableCell onClick={(e) => e.stopPropagation()}>
                {["released", "current"].includes(loan.status) ? (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors hover:opacity-80"
                    onClick={() => onAutoPayClick(loan)}
                  >
                    <Zap
                      className={cn(
                        "h-3 w-3",
                        loan.auto_pay_enabled
                          ? "text-blue-600"
                          : "text-muted-foreground",
                      )}
                    />
                    <span
                      className={
                        loan.auto_pay_enabled
                          ? "text-blue-700 dark:text-blue-300"
                          : "text-muted-foreground"
                      }
                    >
                      {loan.auto_pay_enabled ? "Enabled" : "Enable"}
                    </span>
                  </button>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </TableCell>
            </TableRow>
          ))}
          {loans.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={COLUMNS.length + 1}
                className="h-24 text-center text-muted-foreground"
              >
                No loan applications found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
