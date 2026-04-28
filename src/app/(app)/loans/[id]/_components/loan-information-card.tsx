"use client";

import { FileText, Lock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/format";
import { PAYMENT_FREQUENCY_LABELS } from "@/constants";
import type { Loan } from "@/types/loan";

interface LoanInformationCardProps {
  loan: Loan;
  productName: string;
  interestType: string;
  term: number;
  frequency: string;
  totalPayable: number;
  processingFee: number;
  serviceFee: number;
  otherDeductions: number;
  totalDeductions: number;
  isLocked: boolean;
}

export function LoanInformationCard({
  loan,
  productName,
  interestType,
  term,
  frequency,
  totalPayable,
  processingFee,
  serviceFee,
  otherDeductions,
  totalDeductions,
  isLocked,
}: LoanInformationCardProps) {
  const lockIcon = isLocked && <Lock className="h-3 w-3 text-muted-foreground" />;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          Loan Information
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Application Number</p>
            <p className="text-sm font-medium font-mono">{loan.application_number}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Loan Product</p>
            <p className="text-sm font-medium">{productName || "N/A"}</p>
          </div>
          {loan.purpose && (
            <div className="col-span-2">
              <p className="text-xs text-muted-foreground">Purpose</p>
              <p className="text-sm font-medium">{loan.purpose}</p>
            </div>
          )}
        </div>

        <Separator />

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              Principal Amount
              {lockIcon}
            </p>
            <p className="text-sm font-semibold">{formatCurrency(loan.principal_amount)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              Interest Rate
              {lockIcon}
            </p>
            <p className="text-sm font-medium">{loan.interest_rate}%</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              Interest Type
              {lockIcon}
            </p>
            <p className="text-sm font-medium capitalize">{interestType || "N/A"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              Term
              {lockIcon}
            </p>
            <p className="text-sm font-medium">{term} months</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Payment Frequency</p>
            <p className="text-sm font-medium">
              {(PAYMENT_FREQUENCY_LABELS[frequency as keyof typeof PAYMENT_FREQUENCY_LABELS] ?? frequency) || "N/A"}
            </p>
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Total Payable</p>
            <p className="text-sm font-semibold">{formatCurrency(totalPayable)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Net Proceeds</p>
            <p className="text-sm font-semibold">
              {loan.net_proceeds != null ? formatCurrency(loan.net_proceeds) : "N/A"}
            </p>
          </div>
        </div>

        <Separator />

        <div className="space-y-3">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Deductions</p>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Processing Fee</span>
            <span className="text-sm font-medium">{formatCurrency(processingFee)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Service Fee</span>
            <span className="text-sm font-medium">{formatCurrency(serviceFee)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Other Deductions</span>
            <span className="text-sm font-medium">
              {formatCurrency(otherDeductions > 0 ? otherDeductions : 0)}
            </span>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Total Deductions</span>
            <span className="text-sm font-semibold">{formatCurrency(totalDeductions)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
