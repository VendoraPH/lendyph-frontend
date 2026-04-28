"use client";

import { FileText, Unlock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Loan } from "@/types/loan";
import type { LoanSummary } from "./dialogs/record-payment-dialog";

interface ReleaseDetailsCardProps {
  loan: Loan;
  summary: LoanSummary | null;
  onOpenStatementOfAccount: () => void;
}

export function ReleaseDetailsCard({
  loan,
  summary,
  onOpenStatementOfAccount,
}: ReleaseDetailsCardProps) {
  if (!loan.release_date) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Unlock className="h-4 w-4 text-cyan-600" />
          Release Details
          {summary && (
            <Badge variant="outline" className="text-[10px] bg-green-500/10 text-green-700 border-green-500/30">
              Server-verified
            </Badge>
          )}
        </CardTitle>
        <Button variant="outline" size="sm" onClick={onOpenStatementOfAccount}>
          <FileText className="mr-2 h-4 w-4" />
          Statement of Account
        </Button>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Release Date</p>
            <p className="text-sm font-medium">{formatDate(loan.release_date)}</p>
          </div>
          {loan.maturity_date && (
            <div>
              <p className="text-xs text-muted-foreground">Maturity Date</p>
              <p className="text-sm font-medium">{formatDate(loan.maturity_date)}</p>
            </div>
          )}
          <div>
            <p className="text-xs text-muted-foreground">Next Due Date</p>
            <p className="text-sm font-medium">
              {summary?.next_due_date
                ? formatDate(summary.next_due_date)
                : loan.next_due_date
                  ? formatDate(loan.next_due_date)
                  : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Outstanding Balance</p>
            <p className="text-sm font-semibold">
              {formatCurrency(summary?.outstanding_balance ?? loan.outstanding_balance ?? 0)}
            </p>
          </div>
        </div>
        {summary && (
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
            <div>
              <p className="text-xs text-muted-foreground">Total Paid</p>
              <p className="text-sm font-medium">{formatCurrency(summary.total_paid ?? 0)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Principal Paid</p>
              <p className="text-sm font-medium">{formatCurrency(summary.principal_paid ?? 0)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Interest Paid</p>
              <p className="text-sm font-medium">{formatCurrency(summary.interest_paid ?? 0)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Overdue + Penalty</p>
              <p className="text-sm font-semibold text-red-600">
                {formatCurrency((summary.overdue_amount ?? 0) + (summary.penalty_amount ?? 0))}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
