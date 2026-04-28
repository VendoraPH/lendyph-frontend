"use client";

import { useState } from "react";
import { CheckCircle2, ChevronDown, ChevronUp, FileText, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { LOAN_STATUS_LABELS } from "@/constants";
import type { Loan } from "@/types/loan";
import type { ApprovalStep } from "../_lib/approval-types";

const VISIBLE_LOAN_COUNT = 3;

interface BorrowerActiveLoansProps {
  loans: Loan[];
  loading: boolean;
  approvalSteps: ApprovalStep[];
  loanStatus: string;
  loan?: Loan;
}

export function BorrowerActiveLoans({
  loans,
  loading,
  approvalSteps,
  loanStatus,
  loan,
}: BorrowerActiveLoansProps) {
  const [expanded, setExpanded] = useState(false);
  const visibleLoans = expanded ? loans : loans.slice(0, VISIBLE_LOAN_COUNT);
  const hasMore = loans.length > VISIBLE_LOAN_COUNT;

  const completedSteps = approvalSteps.filter(
    (s) => (s.status === "approved" || s.status === "sent_back") && s.acted_at
  );

  // Show remarks section if we have local approval steps OR server-side approval remarks
  const hasServerRemarks = !!(loan?.approval_remarks || loan?.rejection_remarks);
  const showRemarks = (approvalSteps.length > 0 && loanStatus !== "rejected") || hasServerRemarks;

  return (
    <Collapsible defaultOpen={false}>
      <Card>
        <CardHeader className="cursor-pointer select-none hover:bg-muted/30 transition-colors">
          <CollapsibleTrigger className="w-full text-left group/trigger">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              Borrower&rsquo;s Active Loans
              <Badge variant="outline" className="text-xs font-normal">
                {loading ? "Loading..." : `${loans.length} loan${loans.length !== 1 ? "s" : ""}`}
              </Badge>
              <ChevronDown className="ml-auto h-4 w-4 text-muted-foreground transition-transform group-aria-expanded/trigger:rotate-180 shrink-0" />
            </CardTitle>
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-3">
        {loading ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Loading...</p>
        ) : loans.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No other active loans for this borrower.
          </p>
        ) : (
          <>
            {visibleLoans.map((bl) => {
              const releaseDate = bl.released_at ?? bl.start_date ?? bl.release_date;
              return (
                <div
                  key={bl.id}
                  className="rounded-lg border p-3 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">
                      {bl.loan_product?.name ?? bl.loan_product_name ?? "—"}
                    </span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] px-1.5 py-0 h-4",
                        bl.status === "released" || bl.status === "ongoing"
                          ? "bg-green-500/10 text-green-700 border-green-500/30"
                          : bl.status === "approved"
                            ? "bg-blue-500/10 text-blue-700 border-blue-500/30"
                            : "bg-amber-500/10 text-amber-700 border-amber-500/30"
                      )}
                    >
                      {LOAN_STATUS_LABELS[bl.status as keyof typeof LOAN_STATUS_LABELS] ?? bl.status}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-[10px] text-muted-foreground">Loan Amount</p>
                      <p className="text-xs font-medium tabular-nums">
                        {formatCurrency(bl.principal_amount)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">Outstanding Balance</p>
                      <p className="text-xs font-medium tabular-nums">
                        {bl.outstanding_balance != null
                          ? formatCurrency(bl.outstanding_balance)
                          : "—"}
                      </p>
                    </div>
                  </div>
                  {releaseDate && (
                    <p className="text-[10px] text-muted-foreground">
                      Released: {formatDate(releaseDate)}
                    </p>
                  )}
                </div>
              );
            })}
            {hasMore && (
              <button
                type="button"
                onClick={() => setExpanded((prev) => !prev)}
                className="w-full flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
              >
                {expanded ? (
                  <>
                    Show less <ChevronUp className="h-3.5 w-3.5" />
                  </>
                ) : (
                  <>
                    Show {loans.length - VISIBLE_LOAN_COUNT} more <ChevronDown className="h-3.5 w-3.5" />
                  </>
                )}
              </button>
            )}
          </>
        )}

        {/* Previous Approval Remarks */}
        {showRemarks && (
          <>
            <Separator />
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Previous Approval Remarks</p>
            {completedSteps.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2 text-center">
                No approval actions recorded yet.
              </p>
            ) : (
              <div className="space-y-3">
                {completedSteps.map((step) => (
                  <div
                    key={step.index}
                    className={cn(
                      "rounded-lg border p-3",
                      step.status === "approved"
                        ? "border-green-200 bg-green-50/50 dark:border-green-800/40 dark:bg-green-900/10"
                        : "border-red-200 bg-red-50/50 dark:border-red-800/40 dark:bg-red-900/10"
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div
                        className={cn(
                          "h-6 w-6 rounded-full flex items-center justify-center text-white text-[10px]",
                          step.status === "approved" ? "bg-green-600" : "bg-red-500"
                        )}
                      >
                        {step.status === "approved" ? (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5" />
                        )}
                      </div>
                      <span className="text-xs font-semibold">{step.name}</span>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] px-1.5 py-0 h-4",
                          step.status === "approved"
                            ? "bg-green-500/10 text-green-700 border-green-500/30"
                            : "bg-red-500/10 text-red-700 border-red-500/30"
                        )}
                      >
                        {step.status === "approved" ? "Approved" : "Sent back"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {step.acted_by ?? "—"} · {step.acted_at ? formatDateTime(step.acted_at) : "—"}
                    </p>
                    {step.remarks ? (
                      <p className="text-xs italic mt-1 pl-2 border-l-2 border-muted-foreground/30">
                        &ldquo;{step.remarks}&rdquo;
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground/60 mt-1 italic">
                        No remarks provided
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Server-side approval/rejection remarks (visible to all officers) */}
        {hasServerRemarks && completedSteps.length === 0 && (
          <>
            <Separator />
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Approval Remarks</p>
            {loan?.approval_remarks && (
              <div className="rounded-lg border border-green-200 bg-green-50/50 dark:border-green-800/40 dark:bg-green-900/10 p-3">
                <div className="flex items-center gap-2 mb-1">
                  <div className="h-6 w-6 rounded-full flex items-center justify-center text-white text-[10px] bg-green-600">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-xs font-semibold">
                    {loan.approved_by_user?.full_name ?? loan.approved_by_user?.name ?? loan.approved_by ?? "Approver"}
                  </span>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-green-500/10 text-green-700 border-green-500/30">
                    Approved
                  </Badge>
                </div>
                {loan.approved_at && (
                  <p className="text-xs text-muted-foreground">{formatDateTime(loan.approved_at)}</p>
                )}
                <p className="text-xs italic mt-1 pl-2 border-l-2 border-muted-foreground/30">
                  &ldquo;{loan.approval_remarks}&rdquo;
                </p>
              </div>
            )}
            {loan?.rejection_remarks && (
              <div className="rounded-lg border border-red-200 bg-red-50/50 dark:border-red-800/40 dark:bg-red-900/10 p-3">
                <div className="flex items-center gap-2 mb-1">
                  <div className="h-6 w-6 rounded-full flex items-center justify-center text-white text-[10px] bg-red-500">
                    <XCircle className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-xs font-semibold">
                    {loan.rejected_by ?? "Reviewer"}
                  </span>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-red-500/10 text-red-700 border-red-500/30">
                    Rejected
                  </Badge>
                </div>
                {loan.rejected_at && (
                  <p className="text-xs text-muted-foreground">{formatDateTime(loan.rejected_at)}</p>
                )}
                <p className="text-xs italic mt-1 pl-2 border-l-2 border-muted-foreground/30">
                  &ldquo;{loan.rejection_remarks}&rdquo;
                </p>
              </div>
            )}
          </>
        )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
