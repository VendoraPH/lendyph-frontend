"use client";

import { AlertCircle, RefreshCw } from "lucide-react";
import { PermissionButton } from "@/components/common/permission-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { formatCurrency, formatDate } from "@/lib/format";
import { currencyOrDash } from "@/lib/report-format";
import { cn } from "@/lib/utils";
import type { Repayment } from "@/types";
import {
  ledgerRowDescription,
  ledgerRowPayment,
  type LedgerBalancesView,
  type LedgerCell,
  type LedgerView,
  type LedgerViewRow,
} from "../_lib/loan-ledger";

interface LedgerTableProps {
  /** Null until the server has answered. */
  ledger: LedgerView | null;
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
  /** Show the share capital build-up columns. */
  hasScb: boolean;
  /** The loan's status: a restructured loan's payments can't be voided. */
  loanStatus: string;
  /** The payments the rows name, for receipts, amounts paid and Void. */
  repaymentsById: Map<number, Repayment>;
  onVoid: (repaymentId: number) => void;
  actionLoading: boolean;
}

const dash = <span className="text-muted-foreground/40">—</span>;

/** A figure in its column, or a dash in the column it doesn't move. */
function Figure({ value, className }: { value: number | null; className?: string }) {
  return (
    <td className={cn("border-r px-3 py-2 text-right tabular-nums", className)}>
      {value === null ? dash : formatCurrency(value)}
    </td>
  );
}

function Component({ cell, balance, debitClassName }: { cell: LedgerCell; balance: number | null; debitClassName?: string }) {
  return (
    <>
      <Figure value={cell.debit} className={cell.debit !== null && cell.debit > 0 ? debitClassName : undefined} />
      <Figure value={cell.credit} />
      <td className="border-r px-3 py-2 text-right tabular-nums font-semibold">{currencyOrDash(balance)}</td>
    </>
  );
}

function ClosingBalance({ value }: { value: number | null }) {
  return (
    <>
      <td className="border-r px-3 py-2" />
      <td className="border-r px-3 py-2" />
      <td className="border-r px-3 py-2 text-right tabular-nums font-bold">{currencyOrDash(value)}</td>
    </>
  );
}

/** The premium a payment collected; on a void row, the premium put back. */
function Insurance({ value }: { value: LedgerViewRow["insurance"] }) {
  return (
    <td className="border-r px-3 py-2 text-right tabular-nums">
      {value.amount === null ? (
        dash
      ) : value.restored && value.amount !== 0 ? (
        <span className="whitespace-nowrap">
          {formatCurrency(value.amount)} <span className="text-[10px] text-muted-foreground">restored</span>
        </span>
      ) : (
        formatCurrency(value.amount)
      )}
    </td>
  );
}

function LedgerRow({
  row,
  hasScb,
  loanStatus,
  repayment,
  onVoid,
  actionLoading,
}: {
  row: LedgerViewRow;
  hasScb: boolean;
  loanStatus: string;
  repayment: Repayment | undefined;
  onVoid: (repaymentId: number) => void;
  actionLoading: boolean;
}) {
  const payment = ledgerRowPayment(row, repayment, loanStatus);
  const description = ledgerRowDescription(row.description, payment.voided);
  const repaymentId = row.repaymentId;
  return (
    <tr className={cn("border-b transition-colors hover:bg-muted/30", row.kind === "release" && "bg-blue-50/40 dark:bg-blue-950/20")}>
      <td className="border-r px-3 py-2 text-left whitespace-nowrap">{row.date ? formatDate(row.date) : "—"}</td>
      <td className="border-r px-3 py-2 text-center text-muted-foreground">{payment.refNo}</td>
      <td className="border-r px-3 py-2 text-left font-medium whitespace-nowrap">{row.label}</td>
      <Component cell={row.principal} balance={row.balances.principal} />
      <Component cell={row.interest} balance={row.balances.interest} />
      <Component cell={row.penalty} balance={row.balances.penalty} debitClassName="text-destructive" />
      {hasScb && <Component cell={row.scb} balance={row.balances.scb} />}
      <Insurance value={row.insurance} />
      <Figure value={payment.amountPaid} className="font-semibold" />
      <td className="px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground">{description || dash}</span>
          {payment.voided && (
            <Badge variant="destructive" className="shrink-0 text-[10px] px-1 py-0">voided</Badge>
          )}
          {payment.canVoid && repaymentId !== null && (
            <PermissionButton
              permission="payments:void"
              tooltip="Your role doesn't have permission to void payments"
              wrapperClassName="shrink-0"
              variant="ghost"
              size="sm"
              className="h-5 shrink-0 px-1 text-[10px] text-destructive hover:text-destructive"
              onClick={() => onVoid(repaymentId)}
              disabled={actionLoading}
            >
              Void
            </PermissionButton>
          )}
        </div>
      </td>
    </tr>
  );
}

/**
 * The loan's Ledger: the server's rows (GET /loans/{id}/ledger) with each
 * row's own figures, in the Debit or Credit column by which way they move
 * what is owed, and the running balances after it, all as sent. The balances
 * leave out the insurance premium owed, which payment rows show on their own.
 */
export function LedgerTable({
  ledger,
  loading,
  failed,
  onRetry,
  hasScb,
  loanStatus,
  repaymentsById,
  onVoid,
  actionLoading,
}: LedgerTableProps) {
  // A re-read (after a payment or a void) keeps the rows on screen.
  if (ledger === null && !failed) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner className="size-5 text-muted-foreground" />
      </div>
    );
  }
  if (ledger === null) {
    return (
      <div role="alert" className="flex flex-col items-center gap-3 px-4 py-8 text-center text-sm">
        <p className="flex items-center gap-2 text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          We couldn&rsquo;t load the ledger.
        </p>
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="mr-1.5 size-3.5" />
          Retry
        </Button>
      </div>
    );
  }

  const totalCols = hasScb ? 18 : 15;
  const closing: LedgerBalancesView = ledger.closing;
  return (
    <div className="overflow-x-auto">
      {failed && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2 text-xs text-destructive">
          <span className="flex items-center gap-1.5">
            <AlertCircle className="size-3.5 shrink-0" />
            We couldn&rsquo;t refresh the ledger; these figures may be out of date.
          </span>
          <Button variant="outline" size="sm" className="h-7" onClick={onRetry}>
            <RefreshCw className="mr-1.5 size-3.5" />
            Retry
          </Button>
        </div>
      )}
      {loading && (
        <p role="status" className="flex items-center gap-1.5 border-b px-4 py-1.5 text-[11px] text-muted-foreground">
          <Spinner className="size-3" />
          Updating the ledger…
        </p>
      )}
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="border-b bg-muted/50 text-center font-semibold uppercase tracking-wide text-muted-foreground">
            <th rowSpan={2} className="border-r px-3 py-2 text-left align-middle">Date</th>
            <th rowSpan={2} className="border-r px-3 py-2 align-middle">Ref No</th>
            <th rowSpan={2} className="border-r px-3 py-2 text-left align-middle">Entry</th>
            <th colSpan={3} className="border-r border-b px-3 py-1">Principal</th>
            <th colSpan={3} className="border-r border-b px-3 py-1">Interest</th>
            <th colSpan={3} className="border-r border-b px-3 py-1">Penalty</th>
            {hasScb && <th colSpan={3} className="border-r border-b px-3 py-1">SCB</th>}
            <th rowSpan={2} className="border-r px-3 py-2 align-middle">Insurance Premium</th>
            <th rowSpan={2} className="border-r px-3 py-2 align-middle">Amount Paid</th>
            <th rowSpan={2} className="px-3 py-2 text-left align-middle">Remarks</th>
          </tr>
          <tr className="border-b bg-muted/30 text-center text-muted-foreground">
            {Array.from({ length: hasScb ? 4 : 3 }, (_, i) => (
              <ComponentHeads key={i} />
            ))}
          </tr>
        </thead>
        <tbody>
          {ledger.rows.length === 0 ? (
            <tr>
              <td colSpan={totalCols} className="px-3 py-6 text-center text-muted-foreground">
                No ledger entries yet.
              </td>
            </tr>
          ) : (
            ledger.rows.map((row) => (
              <LedgerRow
                key={row.key}
                row={row}
                hasScb={hasScb}
                loanStatus={loanStatus}
                repayment={row.repaymentId === null ? undefined : repaymentsById.get(row.repaymentId)}
                onVoid={onVoid}
                actionLoading={actionLoading}
              />
            ))
          )}
        </tbody>
        <tfoot>
          <tr className="border-t-2 bg-muted/30">
            <td colSpan={3} className="border-r px-3 py-2 text-left font-semibold">Closing balance</td>
            <ClosingBalance value={closing.principal} />
            <ClosingBalance value={closing.interest} />
            <ClosingBalance value={closing.penalty} />
            {hasScb && <ClosingBalance value={closing.scb} />}
            <td colSpan={3} className="px-3 py-2 text-left text-muted-foreground">
              Insurance premium owed is not in these balances.
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function ComponentHeads() {
  return (
    <>
      <th className="border-r px-3 py-1">Debit</th>
      <th className="border-r px-3 py-1">Credit</th>
      <th className="border-r px-3 py-1">Balance</th>
    </>
  );
}
