"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Banknote, CalendarClock, AlertCircle, CheckCircle2 } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import type { BorrowerLoanSummary, Payment, Loan } from "@/types";
import { memberPaymentFigures } from "../_lib/member-payment-figures";
import { paymentReferenceCell, statusInWords } from "@/app/(app)/borrowers/_components/utils";

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const paymentMethodLabels: Record<string, string> = {
  cash: "Cash",
  bank_transfer: "Bank Transfer",
  gcash: "GCash",
  maya: "Maya",
  online: "Online",
};

const paymentStatusColor: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700 border-yellow-200",
  completed: "bg-green-100 text-green-700 border-green-200",
  voided: "bg-red-100 text-red-700 border-red-200",
};

interface PaymentsTabProps {
  payments: Payment[];
  loans: Loan[];
  /** GET /borrowers/{id}/loan-summary; null while loading or after a failure. */
  summary: BorrowerLoanSummary | null;
}

export function PaymentsTab({ payments, loans, summary }: PaymentsTabProps) {
  // Every money card is the server's figure; a missing one shows a dash.
  const figures = memberPaymentFigures(summary);
  const hasOverdue = (summary?.overdue_amount ?? 0) > 0;

  const ongoingLoans = loans.filter((l) => l.status === "ongoing");
  const nextDueDates = ongoingLoans.map((l) => l.next_due_date).filter(Boolean).sort();
  const nextDueDate = nextDueDates[0];

  const sortedPayments = [...payments].sort((a, b) => {
    const dateA = a.paid_at ?? a.created_at;
    const dateB = b.paid_at ?? b.created_at;
    return dateB.localeCompare(dateA);
  });

  const loanLabelMap = new Map(loans.map((l) => [
    l.id,
    l.loan_account_number ?? l.application_number ?? (l.loan_product?.name ?? l.loan_product_name ?? `Loan ${l.id}`),
  ]));

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total Paid</p>
                <p className="text-2xl font-bold text-green-600">{figures.totalPaid}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-600/30" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Outstanding</p>
                <p className="text-2xl font-bold text-brand-orange">{figures.outstanding}</p>
              </div>
              <Banknote className="h-8 w-8 text-brand-orange/30" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Next Due Date</p>
                <p className="text-2xl font-bold">{nextDueDate ? formatDate(nextDueDate) : "—"}</p>
              </div>
              <CalendarClock className="h-8 w-8 text-muted-foreground/30" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Overdue</p>
                <p className={`text-2xl font-bold ${hasOverdue ? "text-red-600" : ""}`}>
                  {figures.overdue}
                </p>
              </div>
              <AlertCircle className={`h-8 w-8 ${hasOverdue ? "text-red-600/30" : "text-muted-foreground/30"}`} />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Payment History ({payments.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Loan</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedPayments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>{formatDate(payment.paid_at ?? payment.created_at)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {loanLabelMap.get(payment.loan_id) ?? payment.loan_id}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {formatCurrency(payment.amount)}
                      {payment.penalty_amount ? (
                        <span className="text-xs text-red-500 ml-1">
                          (+{formatCurrency(payment.penalty_amount)} penalty)
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell>{paymentMethodLabels[payment.method] ?? payment.method}</TableCell>
                    <TableCell className="text-muted-foreground font-mono text-xs">
                      {paymentReferenceCell(payment)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={paymentStatusColor[payment.status]}>
                        {statusInWords(payment.status)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {payments.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      No payments recorded.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
