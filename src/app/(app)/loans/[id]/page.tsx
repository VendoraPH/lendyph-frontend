"use client";

import { useState, useMemo, useEffect, useCallback, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { notifyError, notifyWarning } from "@/lib/notify";
import { httpStatusOf } from "@/lib/api-error";
import { getErrorMessage } from "@/lib/api-error";
import { AxiosError } from "axios";
import { Spinner } from "@/components/ui/spinner";
import {
  loanService,
  loanApprovalService,
  loanAdjustmentService,
  repaymentService,
  reportService,
} from "@/services";
import type { RepaymentPreview } from "@/services/repayment.service";
import { useAuthStore } from "@/store/auth-store";
import { PrintableMenu, RouteGuard } from "@/components/common";
import { IncompleteListNotice } from "@/components/common/incomplete-list-notice";
import { StaffPicker } from "@/components/common/staff-picker";
import type { PrintableId } from "@/lib/printables/types";
import { toLoanRepayments, type RepaymentListShortfall } from "@/lib/repayment-list";
import { coMakerName } from "@/lib/co-maker-name";
import { loadLoan, loanLoadFailure } from "./_lib/load-loan";
import { readScheduleRows, toDisplaySchedule } from "./_lib/server-schedule";
import { ledgerOpening, walkLedgerBalances } from "./_lib/ledger-balances";
import {
  RestructuredBalanceFigures,
  ScheduleNotice,
  type ScheduleLoad,
} from "./_components/schedule-notice";
import { AmortizationBalanceTable } from "./_components/amortization-balance-table";
import { LoanDocumentsCard } from "./_components/loan-documents-card";
import { ShareCapitalCard } from "./_components/share-capital-card";
import { LoanCollateralsCard } from "./_components/loan-collaterals-card";
import { ReleaseDeductions } from "./_components/release-deductions";
import { ReleaseCoMakers } from "./_components/release-co-makers";
import { InsurancePremiumSection } from "./_components/insurance-premium-section";
import { releaseFigures, releaseInsurancePayload } from "./_lib/release-figures";
import { extensionDueDate } from "./_lib/extension-due-date";
import { useReleasePreview } from "./_hooks/use-release-preview";
import {
  INSURANCE_PREMIUM_INITIAL,
  type InsurancePremiumValue,
} from "./_components/insurance-premium.types";
import { AutoPayToggleDialog } from "@/components/auto-pay-toggle-dialog";
import type { LoanSchedule, LoanLedgerEntry } from "@/types/loan";
import type { LoanAdjustment, LoanAdjustmentType, Repayment } from "@/types";
import { isApprovalChainHidden, loanShouldHaveAChain, type LoanApprovalStep } from "@/types";
import { useLoanApproval } from "@/hooks/use-loan-approval";
import { usePermission } from "@/hooks/use-permission";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { CollapsibleCard } from "@/components/common/collapsible-card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Clock,
  FileText,
  UserCheck,
  Ban,
  Send,
  Unlock,
  Lock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  CalendarIcon,
  CalendarPlus,
  Plus,
  DollarSign,
  ChevronDown,
  ChevronUp,
  Pencil,
  AlertTriangle,
  Receipt,
  CreditCard,
  Loader2,
  BookOpen,
  Zap,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  formatCurrencyExact,
  formatDate,
  formatDateISO,
  formatDateObj,
  formatDateTime,
  formatRate,
} from "@/lib/format";
import {
  LOAN_STATUS_COLORS,
  LOAN_STATUS_LABELS,
  PAYMENT_FREQUENCY_LABELS,
  ADJUSTMENT_TYPE_LABELS,
  ADJUSTMENT_STATUS_LABELS,
  isEverReleasedLoanStatus,
} from "@/constants";
import type { Loan } from "@/types/loan";
import type { ApiScheduleRow } from "@/lib/amortization";
import { readTermUnit, stepsByCalendarMonth } from "@/lib/loan-terms";

// ── Currency & Date Formatters ──

const formatCurrency = (amount: number | string | undefined | null) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(parseFloat(String(amount ?? 0)) || 0));

// Like formatCurrency but keeps centavos — use where the number shown must
// exactly equal a number being posted (e.g. the interest collected on extend),
// so the display never rounds away centavos that are actually charged.
const formatCurrencyPrecise = (amount: number | string | undefined | null) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(parseFloat(String(amount ?? 0)) || 0);


// One row of the Ledger table — either a Repayment or a LoanLedgerEntry
// (interest a loan extension accrues or collects), flattened to a common
// shape so both render in one chronological list with running balances.
interface LedgerDisplayRow {
  key: string;
  date: string;
  createdAt: string;
  refNo: string;
  remarks: string;
  principalPaid?: number;
  interestDebit?: number;
  interestCredit?: number;
  penaltyPaid?: number;
  scbPaid?: number;
  excessAmount?: number;
  totalPaid?: number;
  status?: Repayment["status"];
  repaymentId?: number;
  principalBal: number;
  /** Null while the balance's opening is unknown (no schedule rows on screen). */
  interestBal: number | null;
  scbBal: number | null;
}

// ── Status Colors ──
//
// Loan status colours are NOT here: they live once, in LOAN_STATUS_COLORS
// (`@/constants`), keyed off `LoanStatus`. This file used to keep its own copy
// and it had already drifted — it was missing `ongoing`, so a released loan on
// a schedule drew an unstyled badge on the one screen you open to check it.
// Adjustment statuses below are a different vocabulary and stay local.

const adjustmentStatusColors: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-800",
  approved: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-800",
  rejected: "bg-red-100 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-800",
  applied: "bg-green-100 text-green-700 border-green-200 dark:bg-green-500/15 dark:text-green-400 dark:border-green-800",
};

// ── Multi-Step Approval Chain ──
// Implements the LOAN RELEASE FLOWCHART. The chain is materialised and owned by
// the SERVER (`GET /loans/{loan}/approval-steps`, read here through
// `useLoanApproval`); this page renders it and offers the one action the server
// says the signed-in user may take. It used to live in `localStorage`, which
// meant approvals never crossed devices, "clear site data" erased who had
// signed off, and none of it reached the audit log.
//
// There is deliberately NO client-side derivation of the chain from
// `loans.status` any more, and no migration of the old browser copy. The
// derivation that used to live here (`deriveStepsFromLoanStatus`) WAS the
// drift: it had no branch for `void`, `current` or `past_due`, so all three
// fell through to a draft-like chain and a live, past-due loan rendered with
// the Loan Processor still pending. The server re-derives the chain from the
// authoritative `loans.status` when `loanService.submit()` seeds it. Where the
// server has no answer the card says so — an invented chain is a claim about
// who approved a loan that nobody can verify.
//
// On any "Approved? = No" the loan is sent back for revision (the chain does
// NOT support terminal rejection — "Void Loan" is the escape hatch for drafts).

/**
 * ADVISORY ONLY. The gate is `step.can_act`, which the server computes for the
 * requesting user, and behind that the endpoints themselves. This exists so a
 * button can be disabled before the round trip when the signed-in user plainly
 * lacks the role; it must never be the reason an action is considered allowed.
 */
function canUserActOnStep(
  step: LoanApprovalStep,
  userRoles: string[] | undefined
): boolean {
  if (!userRoles || userRoles.length === 0) return false;
  // Admins (client) and super_admin (developer) can act on any step.
  if (userRoles.includes("admin") || userRoles.includes("super_admin")) return true;
  return userRoles.includes(step.role);
}

// ── Borrower's Active Loans Component ──

const VISIBLE_LOAN_COUNT = 3;

function BorrowerActiveLoans({ loans, loading, truncated = false, approvalSteps, loanStatus, loan }: { loans: Loan[]; loading: boolean; truncated?: boolean; approvalSteps: LoanApprovalStep[]; loanStatus: string; loan?: Loan }) {
  const [expanded, setExpanded] = useState(false);
  const [activeLoansOpen, setActiveLoansOpen] = useState(true);
  const visibleLoans = expanded ? loans : loans.slice(0, VISIBLE_LOAN_COUNT);
  const hasMore = loans.length > VISIBLE_LOAN_COUNT;

  const completedSteps = approvalSteps.filter(
    (s) => (s.status === "approved" || s.status === "sent_back") && s.acted_at
  );

  // Show the remarks section when the server's chain has signoffs to show, OR
  // when the loan carries top-level approval/rejection remarks. `rejected` and
  // `void` both end the chain, so neither shows per-step history.
  const hasServerRemarks = !!(loan?.approval_remarks || loan?.rejection_remarks);
  const showRemarks =
    (approvalSteps.length > 0 && !isApprovalChainHidden(loanStatus)) || hasServerRemarks;

  return (
    <Collapsible open={activeLoansOpen} onOpenChange={setActiveLoansOpen}>
      <Card>
        <CardHeader className="cursor-pointer select-none hover:bg-muted/30 transition-colors">
          <CollapsibleTrigger className="w-full text-left group/trigger">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              Borrower&rsquo;s Active Loans
              <Badge variant="outline" className="text-xs font-normal">
                {loading
                  ? "Loading..."
                  : `${truncated ? "at least " : ""}${loans.length} loan${loans.length !== 1 ? "s" : ""}`}
              </Badge>
              <ChevronDown className="ml-auto h-4 w-4 text-muted-foreground transition-transform group-aria-expanded/trigger:rotate-180 shrink-0" />
            </CardTitle>
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-3">
        {/* An incomplete list of someone's debts must never read as an absence
            of debt. Rendered above the rows (and above the empty state) so it is
            impossible to approve off this card without seeing it. */}
        {!loading && truncated && (
          <div
            role="status"
            className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-200"
          >
            <span className="font-medium">This list may be incomplete.</span>{" "}
            We couldn&rsquo;t confirm all of this borrower&rsquo;s existing loans.
            Check their profile before approving.
          </div>
        )}
        {loading ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Loading...</p>
        ) : loans.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            {truncated
              ? "No other active loans were returned — see the notice above."
              : "No other active loans for this borrower."}
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

// ── Workflow History Component ──

function WorkflowHistory({ loan }: { loan: Loan }) {
  const events: { icon: React.ReactNode; label: string; date: string; detail?: string }[] = [];

  events.push({
    icon: <FileText className="h-4 w-4 text-gray-500" />,
    label: "Application created",
    date: loan.created_at,
  });

  if (
    loan.status !== "draft" &&
    loan.updated_at !== loan.created_at
  ) {
    events.push({
      icon: <Send className="h-4 w-4 text-amber-600" />,
      label: "Submitted for review",
      date: loan.updated_at,
    });
  }

  if (loan.approved_at) {
    events.push({
      icon: <UserCheck className="h-4 w-4 text-blue-600" />,
      label: `Approved by ${loan.approved_by_user?.full_name ?? loan.approved_by_user?.name ?? loan.approved_by ?? "—"}`,
      date: loan.approved_at,
      detail: loan.approval_remarks ?? undefined,
    });
  }

  if (loan.rejected_at) {
    events.push({
      icon: <Ban className="h-4 w-4 text-red-600" />,
      label: `Rejected by ${loan.rejected_by ?? "—"}`,
      date: loan.rejected_at,
      detail: loan.rejection_remarks ?? undefined,
    });
  }

  if (loan.released_at) {
    events.push({
      icon: <Unlock className="h-4 w-4 text-cyan-600" />,
      label: `Released by ${loan.released_by_user?.full_name ?? loan.released_by_user?.name ?? loan.released_by ?? "—"}`,
      date: loan.released_at,
    });
  }

  return (
    <div className="space-y-4">
      {events.map((event, idx) => (
        <div key={idx} className="flex items-start gap-3">
          <div className="mt-0.5">{event.icon}</div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">{event.label}</p>
            <p className="text-xs text-muted-foreground">
              {formatDateTime(event.date)}
            </p>
            {event.detail && (
              <p className="mt-1 text-sm text-muted-foreground italic">
                &ldquo;{event.detail}&rdquo;
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main Page ──

function LoanNotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <AlertCircle className="h-12 w-12 text-muted-foreground" />
      <h2 className="text-xl font-semibold">Loan Not Found</h2>
      <p className="text-muted-foreground">
        The loan application you&apos;re looking for does not exist.
      </p>
      <Link href="/loans">
        <Button variant="outline">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Loans
        </Button>
      </Link>
    </div>
  );
}

/**
 * The loan read failed for a reason that says nothing about the loan — a rate
 * limit, a server error, a dropped connection. Only a 404 is "not found".
 */
function LoanLoadFailed({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center justify-center py-20 gap-4 text-center">
      <AlertCircle className="h-12 w-12 text-muted-foreground" />
      <h2 className="text-xl font-semibold">We couldn&apos;t load this loan</h2>
      <p className="text-muted-foreground max-w-md">{message}</p>
      <div className="flex flex-col-reverse gap-2 sm:flex-row">
        <Button variant="ghost" nativeButton={false} render={<Link href="/loans" />}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Loans
        </Button>
        <Button variant="outline" onClick={onRetry}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Retry
        </Button>
      </div>
    </div>
  );
}

export default function LoanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  // Anything can follow `/loans/` in a hand-edited URL. Only plain digits name
  // a loan — `Number()` alone reads `1e3` as 1000, `0x10` as 16 and ` 12 ` as
  // 12 — so anything else is "not found" without asking the API. Decided here,
  // before the page's own hooks, so such a URL makes no request at all.
  if (!(typeof id === "string" && /^\d+$/.test(id) && Number(id) > 0)) {
    return <LoanNotFound />;
  }
  return (
    <RouteGuard permission="loans:view" pageName="Loan Details">
      <LoanDetail loanId={Number(id)} />
    </RouteGuard>
  );
}

function LoanDetail({ loanId }: { loanId: number }) {
  const router = useRouter();

  const [loan, setLoan] = useState<Loan | undefined>();
  const [loading, setLoading] = useState(true);
  // Why the loan could not be read, when it could not: `not_found` (a 404) is
  // the only answer that means the loan does not exist.
  const [loadFailure, setLoadFailure] = useState<{
    kind: ReturnType<typeof loanLoadFailure>;
    message: string;
  } | null>(null);
  // Bumped by the failed-load Retry, which re-runs the load effect below.
  const [loanReloadCount, setLoanReloadCount] = useState(0);
  const [actionLoading, setActionLoading] = useState(false);
  // The persisted schedule, for released loans. Null until the server has
  // answered; `scheduleFailed` says whether it could not be asked. An empty list
  // is an answer: the loan has no instalments.
  const [apiSchedule, setApiSchedule] = useState<LoanSchedule[] | null>(null);
  const [scheduleFailed, setScheduleFailed] = useState(false);
  // Raw amortization rows exactly as the backend returns them. The mapped
  // `apiSchedule` above folds each row's interest_paid into amount_paid, which
  // loses the per-row interest breakdown; we keep the raw rows so the extend
  // flow can read the true outstanding interest (interest_due - interest_paid).
  const [rawSchedule, setRawSchedule] = useState<ApiScheduleRow[] | null>(null);

  // Server-side balance summary (for released loans). Populated via
  // loanService.summary — gives authoritative outstanding/overdue figures
  // that supersede client-side calculations when present.
  const [loanSummary, setLoanSummary] = useState<{
    outstanding_balance?: number;
    total_paid?: number;
    principal_paid?: number;
    interest_paid?: number;
    overdue_amount?: number;
    penalty_amount?: number;
    next_due_date?: string;
    next_due_amount?: number;
  } | null>(null);

  // Server-computed amortization preview (for pre-release loans). Populated
  // via loanService.amortizationPreview — lets approvers see the same schedule
  // the server will persist on release. Null and `previewFailed` as above.
  const [previewSchedule, setPreviewSchedule] = useState<LoanSchedule[] | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);
  // Bumped by the schedule card's Retry, which re-runs the effects that read it.
  const [scheduleReloadCount, setScheduleReloadCount] = useState(0);

  // Statement of Account dialog state
  const [soaOpen, setSoaOpen] = useState(false);
  const [soaLoading, setSoaLoading] = useState(false);
  const [soaData, setSoaData] = useState<Record<string, unknown> | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(true);
  const [approvalStepsOpen, setApprovalStepsOpen] = useState(true);
  const [memberCoMakerOpen, setMemberCoMakerOpen] = useState(true);
  const [workflowHistoryOpen, setWorkflowHistoryOpen] = useState(true);

  // Repayments state
  const [repayments, setRepayments] = useState<Repayment[]>([]);
  const [repaymentsLoading, setRepaymentsLoading] = useState(false);
  // Set only when the repayment drain gave up with pages outstanding, i.e. the
  // ledger is knowingly missing payments. Null means complete.
  const [repaymentsShortfall, setRepaymentsShortfall] = useState<RepaymentListShortfall | null>(null);
  // Ledger debit/credit entries (interest an extension accrues/collects) —
  // merged with repayments into `ledgerRows` below.
  const [ledgerEntries, setLedgerEntries] = useState<LoanLedgerEntry[]>([]);
  const [ledgerEntriesLoading, setLedgerEntriesLoading] = useState(false);
  // Bumped after an action that posts to the share-capital ledger (a payment
  // credits any SCB build-up, a void reverses it) so the Share Capital card
  // re-reads its balance. No other action writes to that ledger.
  const [shareCapitalVersion, setShareCapitalVersion] = useState(0);
  const [recordPaymentOpen, setRecordPaymentOpen] = useState(false);
  const [paymentDate, setPaymentDate] = useState<Date>(new Date());
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentRemarks, setPaymentRemarks] = useState("");
  const [paymentDatePickerOpen, setPaymentDatePickerOpen] = useState(false);
  const [paymentPreview, setPaymentPreview] = useState<RepaymentPreview | null>(null);
  const [paymentPreviewLoading, setPaymentPreviewLoading] = useState(false);
  const [paymentMode, setPaymentMode] = useState<"regular" | "advance">("regular");
  const [advancePeriods, setAdvancePeriods] = useState<number>(1);
  const [autoPayConfirmOpen, setAutoPayConfirmOpen] = useState(false);
  const [autoPayProcessing, setAutoPayProcessing] = useState(false);

  // Loan Extension state (Upon Maturity loans)
  const [extendOpen, setExtendOpen] = useState(false);
  const [extendRemarks, setExtendRemarks] = useState("");
  const [partialExtendOpen, setPartialExtendOpen] = useState(false);
  const [pendingPayment, setPendingPayment] = useState<{
    payment_date: string;
    amount_paid: number;
    remarks?: string;
  } | null>(null);
  // What to do with interest already outstanding when the loan extends.
  // Defaults to "pay", which is how extension behaved before the choice
  // existed. The API performs the collection itself, so there is no longer a
  // client-side payment step to guard against repeating.
  const [extendInterestOption, setExtendInterestOption] = useState<"pay" | "defer">("pay");

  // Loan Adjustments state
  const [adjustments, setAdjustments] = useState<LoanAdjustment[]>([]);
  const [adjustmentsLoading, setAdjustmentsLoading] = useState(false);
  const [createAdjustmentOpen, setCreateAdjustmentOpen] = useState(false);
  const [adjType, setAdjType] = useState<LoanAdjustmentType>("balance_adjustment");
  const [adjDescription, setAdjDescription] = useState("");
  const [adjRemarks, setAdjRemarks] = useState("");
  // User-friendly adjustment fields
  const [adjNewBalance, setAdjNewBalance] = useState("");
  const [adjAdditionalMonths, setAdjAdditionalMonths] = useState("");


  // Account Officer state
  const [aoEditing, setAoEditing] = useState(false);
  const [aoSaving, setAoSaving] = useState(false);

  // Fetch loan on mount, and again on Retry. `loading` is already true when
  // this runs (initially, or set by `reloadLoan`), so state is only set once
  // the request settles.
  useEffect(() => {
    let cancelled = false;
    loadLoan(loanId, null)
      .then((loaded) => {
        if (!cancelled) setLoan(loaded);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadFailure({
          kind: loanLoadFailure(err),
          message: getErrorMessage(err, "Please try again in a moment."),
        });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [loanId, loanReloadCount]);

  const reloadLoan = () => {
    setLoading(true);
    setLoadFailure(null);
    setLoanReloadCount((n) => n + 1);
  };

  // `loans:update` edits a loan application and assigns its account officer.
  // The officer is saved through `PATCH /loans/{id}/account-officer`, which
  // needs it, and the picker's `GET /staff` accepts that same permission. It
  // used to require `users:view` as well, which only admins hold, so loan
  // officers never saw the control.
  const canUpdateLoan = usePermission().can("loans:update");

  // Save AO assignment. This goes through its own endpoint, not `update`: PUT
  // /loans/{id} refuses every loan past for_review. The page shows what the
  // server saved, not what was picked.
  const handleSaveAO = useCallback(async (userId: number) => {
    if (!loan) return;
    setAoSaving(true);
    try {
      const saved = await loanService.assignAccountOfficer(loan.id, userId);
      setLoan((prev) => prev ? { ...prev, account_officer_id: saved.account_officer_id, account_officer: saved.account_officer } : prev);
      toast.success("Account officer updated");
      setAoEditing(false);
    } catch (err) {
      notifyError(err, "We couldn't update the account officer. Please try again.");
    } finally {
      setAoSaving(false);
    }
  }, [loan]);

  // Fetch schedule for released+ loans. A failed or unreadable answer is
  // recorded as such: nothing stands in for the server's rows.
  const fetchSchedule = useCallback(async (id: number) => {
    try {
      const read = readScheduleRows(await loanService.schedule(id), id);
      setApiSchedule(read?.schedule ?? null);
      setRawSchedule(read?.raw ?? null);
      setScheduleFailed(read === null);
    } catch {
      setApiSchedule(null);
      setRawSchedule(null);
      setScheduleFailed(true);
    }
  }, []);

  // Fetch server-side balance summary for released+ loans
  const fetchLoanSummary = useCallback(async (id: number) => {
    try {
      const res = await loanService.summary(id);
      const payload = (res && typeof res === "object" && "data" in (res as Record<string, unknown>)
        ? (res as { data: unknown }).data
        : res) as Record<string, unknown> | null;
      setLoanSummary(payload ?? null);
    } catch {
      setLoanSummary(null);
    }
  }, []);

  // Fetch server-computed amortization preview for draft/for_review loans.
  // Its rows carry the same `*_due` fields as the persisted schedule.
  const fetchAmortizationPreview = useCallback(async (id: number) => {
    try {
      const rows = readScheduleRows(await loanService.amortizationPreview(id), id)?.schedule ?? null;
      setPreviewSchedule(rows);
      setPreviewFailed(rows === null);
    } catch {
      setPreviewSchedule(null);
      setPreviewFailed(true);
    }
  }, []);

  // The loaded loan's id and status as plain values. The fetch effects below
  // read only these, so they re-run when one of them changes, not every time a
  // refetch or an action hands back a new `loan` object. `loadedLoanId` stays
  // undefined until the loan arrives, unlike the route's `loanId`.
  const loadedLoanId = loan?.id;
  const loanStatus = loan?.status;
  // Statuses for which the backend has schedule / repayment / adjustment data:
  // every loan that was released, whatever became of it since.
  const hasServerLoanData = isEverReleasedLoanStatus(loanStatus);

  // Released-loan data is read when the loan is first known to have it: on
  // first load, and when a release moves it into that set. These effects key
  // on the flag, not the status, because every status change INSIDE the set
  // (a payment settling a past_due loan, a void, an extension, an applied
  // adjustment) comes from an action that re-reads what it changed itself;
  // keyed on the status, each of those re-read everything a second time.
  useEffect(() => {
    if (loadedLoanId !== undefined && hasServerLoanData) {
      fetchSchedule(loadedLoanId);
      fetchLoanSummary(loadedLoanId);
    }
  }, [loadedLoanId, hasServerLoanData, fetchSchedule, fetchLoanSummary, scheduleReloadCount]);

  // Pre-release preview (draft / for_review / approved)
  useEffect(() => {
    if (loadedLoanId !== undefined && loanStatus && ["draft", "for_review", "approved"].includes(loanStatus)) {
      fetchAmortizationPreview(loadedLoanId);
    }
  }, [loadedLoanId, loanStatus, fetchAmortizationPreview, scheduleReloadCount]);

  // Where this loan's schedule comes from: the persisted schedule once it is
  // released, the server's preview before that, nowhere for a rejected or void
  // loan. `scheduleRows` is that source's answer, null until there is one.
  const scheduleSource: "persisted" | "preview" | null = hasServerLoanData
    ? "persisted"
    : loanStatus && ["draft", "for_review", "approved"].includes(loanStatus)
      ? "preview"
      : null;
  const scheduleRows =
    scheduleSource === "persisted" ? apiSchedule : scheduleSource === "preview" ? previewSchedule : null;
  const scheduleLoad: ScheduleLoad =
    scheduleRows !== null
      ? "loaded"
      : (scheduleSource === "persisted" ? scheduleFailed : previewFailed)
        ? "failed"
        : "loading";

  // Retry from the schedule card: back to loading, then the effects above read
  // the schedule (and the summary beside it) again.
  const retrySchedule = () => {
    setScheduleFailed(false);
    setPreviewFailed(false);
    setScheduleReloadCount((n) => n + 1);
  };

  // Payments need `payments:view` and adjustments `loan_adjustments:view`,
  // neither of which viewing a loan implies (the approval-chain roles hold only
  // `loans:view`). Without one, that history is not asked for and stays empty.
  const canViewPayments = usePermission().can("payments:view");
  const canViewAdjustments = usePermission().can("loan_adjustments:view");

  // Fetch repayments for released+ loans. Each list row is the full
  // RepaymentResource — the same payload `GET /repayments/{id}` returns — and
  // the ledger's breakdown fields (principal_paid, interest_paid, penalty_paid)
  // are read off its `*_amount` aliases by withBreakdown(). This used to ask for
  // every row's detail on the belief that the list omitted the breakdown; it
  // never did, and each of those requests returned the row it started from.
  const fetchRepayments = useCallback(async (id: number) => {
    if (!canViewPayments) return;
    try {
      setRepaymentsLoading(true);
      // Drained across pages. This was `repaymentService.list(id)` — the
      // endpoint's default page of 15, and the OLDEST 15, since the list is
      // oldest-first — so from a loan's sixteenth payment on the ledger lost
      // its newest payments and every running balance after them. A loan with
      // N payments now costs ceil(N / 100) requests, and nothing per row.
      const { rows, shortfall } = toLoanRepayments(
        await repaymentService.listAllForLoan(id),
      );
      setRepayments(rows);
      setRepaymentsShortfall(shortfall);
    } catch {
      // silently fail
    } finally {
      setRepaymentsLoading(false);
    }
  }, [canViewPayments]);

  // Fetch debit/credit ledger entries for released+ loans — merged into
  // `ledgerRows` alongside repayments.
  const fetchLedgerEntries = useCallback(async (id: number) => {
    try {
      setLedgerEntriesLoading(true);
      const res = await loanService.ledgerEntries(id);
      const list: LoanLedgerEntry[] = Array.isArray(res) ? res : res.data ?? [];
      setLedgerEntries(list);
    } catch {
      // silently fail — the ledger still renders correctly from repayments alone
    } finally {
      setLedgerEntriesLoading(false);
    }
  }, []);

  // Fetch adjustments for released+ loans
  const fetchAdjustments = useCallback(async (id: number) => {
    if (!canViewAdjustments) return;
    try {
      setAdjustmentsLoading(true);
      const res = await loanAdjustmentService.list(id);
      const list = Array.isArray(res) ? [...res] : [];
      // Newest first — the list endpoint doesn't guarantee an order, so sort by
      // created_at desc for a readable history (latest extension/adjustment on top).
      list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setAdjustments(list);
    } catch {
      // silently fail
    } finally {
      setAdjustmentsLoading(false);
    }
  }, [canViewAdjustments]);

  useEffect(() => {
    if (loadedLoanId !== undefined && hasServerLoanData) {
      fetchRepayments(loadedLoanId);
      fetchAdjustments(loadedLoanId);
      fetchLedgerEntries(loadedLoanId);
    }
  }, [loadedLoanId, hasServerLoanData, fetchRepayments, fetchAdjustments, fetchLedgerEntries]);

  // Dialog state
  const [releaseOpen, setReleaseOpen] = useState(false);
  const [autoPayDialogOpen, setAutoPayDialogOpen] = useState(false);
  const [autoPayIsPostRelease, setAutoPayIsPostRelease] = useState(false);

  const [insurancePremium, setInsurancePremium] = useState<InsurancePremiumValue>(
    INSURANCE_PREMIUM_INITIAL,
  );
  // What the release will withhold and pay out before insurance, read from the
  // server once while the loan awaits release. The Release dialog and, for
  // whoever can release it, the Loan Information card show no deduction, total
  // or net for an approved loan that does not come from here. The endpoint
  // needs `loans:release`, so without it the card keeps the recorded figures
  // and nothing is asked for unless the dialog is opened.
  const canReleaseLoan = usePermission().can("loans:release");
  const releasePreviewOnCard = loan?.status === "approved" && canReleaseLoan;
  const { state: releasePreview, reload: reloadReleasePreview } = useReleasePreview(
    loanId,
    loan?.status === "approved" && (canReleaseLoan || releaseOpen),
  );

  // Multi-step approval workflow — SERVER-OWNED, read-only here. Acting on a
  // step goes to the API and is followed by a refetch; nothing on this page is
  // the source of truth for who signed off. `approvalUnavailable` means the
  // chain could not be read (404 until the endpoint ships, or a loan whose
  // chain was never seeded) and must be rendered as such, not as "no approvals".
  const {
    steps: approvalSteps,
    rounds: approvalRounds,
    loading: approvalLoading,
    unavailable: approvalUnavailable,
    refresh: refreshApproval,
  } = useLoanApproval(loan?.id, loan?.status);
  const [stepRemarks, setStepRemarks] = useState("");
  const [stepActionLoading, setStepActionLoading] = useState(false);
  // Index of the step an approver is sending the loan back to. Defaults to
  // the most recent prior approver, falling back to the Loan Processor. See
  // `sendBackTargets` below for the list of valid choices.
  const [sendBackTargetIndex, setSendBackTargetIndex] = useState<number>(0);

  // Borrower's other active loans — shown during approval so officers can
  // see the borrower's existing obligations before approving.
  const [borrowerLoans, setBorrowerLoans] = useState<Loan[]>([]);
  const [borrowerLoansLoading, setBorrowerLoansLoading] = useState(false);
  // The drain hit its page guard, or the request failed outright. Either way the
  // list below is knowingly incomplete and must say so rather than read as "no
  // other debt" — the approver is making a credit decision on it.
  const [borrowerLoansTruncated, setBorrowerLoansTruncated] = useState(false);
  // Current logged-in user (used to gate approval actions by role)
  // `loans:void` is held only by admin and super_admin. `loan_processor` is
  // precisely who sits on a draft, so an ungated Void button offers that role
  // an action it can never complete — QA measured it: 403, loan unchanged, and
  // a toast saying "please try again" for a permission wall that retrying will
  // never clear. Edit and Submit are gated for the same reason.
  //
  // Called up here with the other hooks, not beside the flag it feeds: this
  // component has early returns below, and a hook after one breaks the order.
  const canVoidLoan = usePermission().can("loans:void");
  // Submitting a restructure application needs only `loans:restructure`.
  const canRestructureLoan = usePermission().can("loans:restructure");
  // The documents card's own defaults offered upload and delete to anyone who
  // can open a loan. Uploading to a loan needs `loans:update` and deleting a
  // document `borrowers:delete` (DocumentController).
  const canDeleteDocuments = usePermission().can("borrowers:delete");

  const currentUser = useAuthStore((s) => s.user);
  const currentUserDisplayName =
    currentUser?.full_name ||
    [currentUser?.first_name, currentUser?.last_name].filter(Boolean).join(" ") ||
    currentUser?.username ||
    "Unknown User";

  // The schedule on screen: the server's rows, persisted or previewed, and
  // nothing else. The browser never builds a schedule of its own for a loan it
  // shows — no rows from the server (a restructured loan whose open periods the
  // release deleted, a request that failed) means no rows here, and the card
  // says which. For an approved loan these are the preview rows, which is what
  // the Release dialog shows: the schedule the release will store.
  //
  // The memo lists the loan FIELDS it reads rather than `loan`, so a refetch
  // that returns the same terms does not recompute it. That only holds while
  // every read goes through a listed field, which is why the has-a-loan guard
  // reads `loan?.id`, not `loan`.
  const storedSchedule = useMemo(() => {
    if (!loan?.id || !scheduleRows) return [];
    const freq = loan.frequency ?? loan.payment_frequency ?? "monthly";
    return toDisplaySchedule(scheduleRows, {
      principalAmount: loan.principal_amount,
      scb: loan.scb_amount ?? 0,
      isUponMaturity:
        freq === "upon_maturity" || loan.interest_method === "upon_maturity" || loan.interest_type === "upon_maturity",
    });
  }, [loan?.id, loan?.principal_amount, loan?.frequency, loan?.payment_frequency, loan?.interest_method, loan?.interest_type, loan?.scb_amount, scheduleRows]);

  // Column totals of the Release dialog's schedule preview.
  const scheduleTotals = useMemo(
    () =>
      storedSchedule.reduce(
        (acc, row) => ({
          principal: acc.principal + row.principal,
          interest: acc.interest + row.interest,
          shareCapitalBuildUp: acc.shareCapitalBuildUp + row.shareCapitalBuildUp,
          totalPayment: acc.totalPayment + row.totalPayment,
        }),
        { principal: 0, interest: 0, shareCapitalBuildUp: 0, totalPayment: 0 },
      ),
    [storedSchedule],
  );

  // Single source of truth for the interest still OWED on the loan — used both
  // to decide whether to collect it before extending, and to render the
  // "Interest Due" amount in the Extend dialog.
  //
  // This must be the OUTSTANDING interest, not the gross interest_due. It is
  // computed from the raw amortization rows as Σ max(0, interest_due −
  // interest_paid) over every not-fully-paid period. The gross sum (what the
  // collapsed upon-maturity row exposes) re-charges interest already collected
  // in earlier periods: after the backend's /extend carries a settled period
  // forward alongside a new one, a 2nd extension would bill period-1's interest
  // again. Netting out interest_paid per row means a settled period contributes
  // 0, so extension N collects exactly period-N's still-unpaid interest.
  //
  // Rounded to centavos so the displayed figure and the posted amount match to
  // the last decimal (formatCurrencyPrecise shows the same value we charge).
  //
  // Null while the server's schedule is loading or could not be read: the
  // interest owed is then unknown, which is not the same as none.
  const currentInterestDue = useMemo(() => {
    if (rawSchedule && rawSchedule.length > 0) {
      const outstanding = rawSchedule.reduce((sum, row) => {
        const due = parseFloat(String(row.interest_due ?? 0)) || 0;
        const paid = parseFloat(String(row.interest_paid ?? 0)) || 0;
        return sum + Math.max(0, due - paid);
      }, 0);
      return Math.round(outstanding * 100) / 100;
    }
    if (scheduleLoad !== "loaded") return null;
    // No raw API rows: the server answered with no instalments (nothing is
    // owed), or with rows lacking the paid breakdown, where the first open
    // period's interest is the amount owed.
    const fallback = storedSchedule.find((row) => row.status !== "paid")?.interest ?? 0;
    return Math.round(fallback * 100) / 100;
  }, [rawSchedule, storedSchedule, scheduleLoad]);

  /**
   * What the new period will owe in interest if the outstanding amount is
   * deferred: today's unpaid interest plus one fresh cycle on the unpaid
   * principal. Mirrors LoanAdjustmentService::extendLoan, which charges a flat
   * `principal × rate` per cycle regardless of how many days the cycle spans.
   *
   * Display only — the API recomputes it. Null when the figures needed aren't
   * available, so the dialog omits the line rather than showing a wrong total.
   */
  const extendDeferredInterestTotal = useMemo(() => {
    const rate = parseFloat(String(loan?.interest_rate ?? 0)) || 0;
    if (!rate || !rawSchedule || rawSchedule.length === 0 || currentInterestDue === null) return null;

    const outstandingPrincipal = rawSchedule.reduce((sum, row) => {
      const due = parseFloat(String(row.principal_due ?? 0)) || 0;
      const paid = parseFloat(String(row.principal_paid ?? 0)) || 0;
      return sum + Math.max(0, due - paid);
    }, 0);

    const fresh = Math.round(outstandingPrincipal * (rate / 100) * 100) / 100;
    return Math.round((currentInterestDue + fresh) * 100) / 100;
  }, [rawSchedule, loan?.interest_rate, currentInterestDue]);

  const storedScheduleTotals = useMemo(() => {
    return storedSchedule.reduce(
      (acc, row) => ({
        principal: acc.principal + row.principal,
        interest: acc.interest + row.interest,
        shareCapitalBuildUp: acc.shareCapitalBuildUp + row.shareCapitalBuildUp,
        totalPayment: acc.totalPayment + row.totalPayment,
      }),
      { principal: 0, interest: 0, shareCapitalBuildUp: 0, totalPayment: 0 },
    );
  }, [storedSchedule]);

  // Ledger rows: repayments merged with debit/credit ledger entries (interest
  // a loan extension accrues or collects), sorted by date so the table reads
  // as one chronological history with running Principal/Interest/SCB balances.
  const ledgerRows = useMemo(() => {
    // The API's category can widen to "principal" / "penalty" later even
    // though only "interest" entries exist today (see LoanLedgerEntry) — this
    // table only has an Interest debit/credit pair to put them in, so entries
    // in some other category are left out rather than mislabeled as interest.
    const interestEntries = ledgerEntries.filter((e) => e.category === "interest");

    // A "pay" extension collects interest through a real Repayment AND logs
    // the same money again as a credit ledger entry (linked via
    // repayment_id) so it carries a description. Keep the ledger entry — it's
    // the one with the description — and drop the repayment it stands in
    // for, or that collection would render, and count, twice.
    const creditedRepaymentIds = new Set(
      interestEntries.map((e) => e.repayment_id).filter((id): id is number => id != null),
    );
    const keptRepayments = repayments.filter((r) => !creditedRepaymentIds.has(r.id));

    const repaymentRows: LedgerDisplayRow[] = keptRepayments.map((r) => ({
      key: `repayment-${r.id}`,
      date: r.payment_date,
      createdAt: r.created_at,
      refNo: (r as Repayment & { receipt_number?: string }).receipt_number ?? `OR-${String(r.id).padStart(6, "0")}`,
      remarks: r.remarks || "payment",
      principalPaid: r.principal_paid,
      interestCredit: r.interest_paid,
      penaltyPaid: r.penalty_paid,
      scbPaid: r.scb_paid,
      excessAmount: r.excess_amount,
      totalPaid: r.amount_paid,
      status: r.status,
      repaymentId: r.id,
      principalBal: 0,
      interestBal: 0,
      scbBal: 0,
    }));

    const ledgerEntryRows: LedgerDisplayRow[] = interestEntries.map((e) => ({
      key: `ledger-${e.id}`,
      date: e.entry_date,
      createdAt: e.created_at,
      refNo: "—",
      remarks: e.description,
      interestDebit: e.type === "debit" ? e.amount : undefined,
      interestCredit: e.type === "credit" ? e.amount : undefined,
      // A credit here IS the cash collection (its Repayment twin was dropped
      // above), so it belongs in Total Paid too; a debit moves no cash.
      totalPaid: e.type === "credit" ? e.amount : undefined,
      principalBal: 0,
      interestBal: 0,
      scbBal: 0,
    }));

    const sorted = [...repaymentRows, ...ledgerEntryRows].sort((a, b) => {
      const byDate = new Date(a.date).getTime() - new Date(b.date).getTime();
      if (byDate !== 0) return byDate;
      // Same-day tiebreaker: a debit and its paired credit share an entry_date,
      // so fall back to creation order to keep them in a stable, sensible sequence.
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    // Interest must walk FORWARD — a debit (extension interest accruing)
    // raises what's owed; a credit or repayment lowers it — unlike
    // Principal/SCB, which only ever go down. The API only ever debits
    // extension interest; the loan's origination interest was never posted
    // as a ledger entry, so this can't start at 0 either. Instead, solve for
    // the opening balance that makes the LAST row land exactly on
    // currentInterestDue — this file's own "single source of truth" for what's
    // actually still owed (see its definition above). With no schedule rows
    // there is nothing to solve from, and ledgerOpening leaves it unknown. storedScheduleTotals.interest
    // is deliberately NOT the anchor here even though it seeds the Interest
    // column of the static "Loan released" row above: it's a gross, never-paid-down
    // total (Σ interest_due across every period the schedule has ever had), so
    // once anything has been paid it no longer equals what's outstanding today —
    // anchoring to it would land the last row on a number too high by whatever's
    // already been paid off. currentInterestDue nets paid amounts out already, so:
    //
    //   opening = currentInterestDue − debits + credits + interest paid
    //
    // and re-applying every debit/credit/payment below recreates that same
    // closing figure at the end of the walk — verified against worked examples
    // covering a bare "pay" extension and a "defer" extension stacked after one,
    // both landing exactly on currentInterestDue.
    const opening = ledgerOpening({
      principalAmount: loan?.principal_amount ?? 0,
      scheduleRowCount: storedSchedule.length,
      currentInterestDue,
      scheduleScbTotal: storedScheduleTotals.shareCapitalBuildUp,
      interestDebits: interestEntries.reduce((s, e) => s + (e.type === "debit" ? e.amount : 0), 0),
      interestCredits: interestEntries.reduce((s, e) => s + (e.type === "credit" ? e.amount : 0), 0),
      interestPaid: keptRepayments.reduce((s, r) => s + (r.interest_paid ?? 0), 0),
    });
    return walkLedgerBalances(sorted, opening);
  }, [repayments, ledgerEntries, loan?.principal_amount, currentInterestDue, storedSchedule.length, storedScheduleTotals.shareCapitalBuildUp]);

  // Fetch borrower's other active loans when viewing a loan under approval.
  // This lets approvers see the borrower's existing obligations.
  //
  // The status filter runs on the SERVER (see `obligationsForBorrower`). It used
  // to ask for `per_page: 50` and filter the reply here, which meant it only
  // ever examined the borrower's 50 newest loans: a member whose recent history
  // is a run of `completed` loans pushed every live one off that page and the
  // card rendered "No other active loans" over real, outstanding debt.
  //
  // Keyed on the RESOLVED borrower id, the value the request actually uses, so
  // a loan payload that names the member only by `borrower_id` is not taken
  // for a change of member.
  const loanBorrowerId = loan?.borrower?.id ?? loan?.borrower_id;
  useEffect(() => {
    if (!loanBorrowerId) return;
    let cancelled = false;
    setBorrowerLoansLoading(true);
    setBorrowerLoansTruncated(false);
    loanService
      .obligationsForBorrower(loanBorrowerId)
      .then(({ rows, truncated }) => {
        if (cancelled) return;
        // Every row here is already an obligation; the only thing left to drop
        // is the loan being viewed, which is display logic rather than a filter.
        setBorrowerLoans(rows.filter((l) => l.id !== loadedLoanId));
        setBorrowerLoansTruncated(truncated);
      })
      .catch(() => {
        if (cancelled) return;
        setBorrowerLoans([]);
        // A failed read is not "no obligations". Reuse the same banner so the
        // card never presents an empty list as a confirmed absence of debt.
        setBorrowerLoansTruncated(true);
      })
      .finally(() => {
        if (!cancelled) setBorrowerLoansLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loanBorrowerId, loadedLoanId]);

  // Valid send-back targets for the current approver: every earlier step
  // whose kind is "submit" (Loan Processor) or "approve" (a prior approver).
  // An approver at position N can return the loan to any of these. Computed
  // here (before the loading/not-found early returns) so hook order is stable.
  const sendBackTargets = useMemo(() => {
    const pendingIdx = approvalSteps.findIndex((s) => s.status === "pending");
    if (pendingIdx < 0) return [];
    const pending = approvalSteps[pendingIdx];
    if (pending.kind !== "approve") return [];
    return approvalSteps
      .slice(0, pendingIdx)
      .filter((s) => s.kind === "submit" || s.kind === "approve")
      .map((s) => ({ index: s.index, name: s.name, kind: s.kind }));
  }, [approvalSteps]);

  // Base UI resolves <SelectValue> labels from `items`, not from the mounted
  // <SelectItem> children — without it the "Send back to" trigger showed the
  // raw value, which here is the step's `index` (the server's `step_order`),
  // so the closed dropdown read "2" instead of the step name the rest of the
  // chain renders.
  const sendBackTargetItems = useMemo(
    () => sendBackTargets.map((t) => ({ value: String(t.index), label: t.name })),
    [sendBackTargets],
  );

  // When the set of valid targets changes, default to the most recent prior
  // approver (or the Loan Processor if there is none).
  useEffect(() => {
    if (sendBackTargets.length > 0) {
      setSendBackTargetIndex(
        sendBackTargets[sendBackTargets.length - 1].index
      );
    }
  }, [sendBackTargets]);

  const isLocked = hasServerLoanData;

  // Resolve actual API field names with fallbacks to legacy flat fields
  const loanBorrowerName = loan?.borrower?.full_name ?? loan?.borrower?.name ?? loan?.borrower_name ?? "";
  const loanCoMakers = loan?.co_makers ?? [];
  const loanProductName = loan?.loan_product?.name ?? loan?.loan_product_name ?? "";
  const loanInterestType = loan?.interest_method ?? loan?.interest_type ?? "";
  const loanTerm = loan?.term ?? loan?.term_months ?? 0;
  // `term` is the agreed term; how many times the loan has since been
  // extended is a separate, additive fact (`extension_count`). Showing both
  // keeps a rolled-forward loan from reading as if it had a longer original
  // term than the borrower agreed to.
  const loanExtensionCount = loan?.extension_count ?? 0;
  const loanTermUnit = readTermUnit(loan?.term_unit);
  const loanTermUnitWord =
    loanTermUnit === "days" ? (loanTerm === 1 ? "day" : "days") : (loanTerm === 1 ? "month" : "months");
  const loanTermLabel =
    `${loanTerm} ${loanTermUnitWord}` +
    (loanExtensionCount > 0 ? ` · extended ×${loanExtensionCount}` : "");
  const loanFrequency = loan?.frequency ?? loan?.payment_frequency ?? "";
  // A term extension adds instalments. Those are months only when the loan
  // steps by calendar month; otherwise they are the loan's own payment periods.
  const extendsByMonth = stepsByCalendarMonth(loanTermUnit, loanFrequency || "monthly");
  // Extend-dialog preview: the maturity date the extension will store, stepped
  // from the server's own schedule the way the extend endpoint steps it, on
  // the start date's day of the month. This is display-only — it does not
  // drive the actual extend() call.
  const extendPreviewMaturityDate = rawSchedule
    ? extensionDueDate(rawSchedule, loanFrequency, loan?.start_date)
    : null;
  // Backend stores `deductions` as an array of {name, amount, type} objects
  // (LoanService::computeDeductions). Earlier code assumed it was an object
  // keyed by fee name and silently fell through to 0 for every fee, which
  // collapsed all fees into the "Other Deductions" bucket on the UI.
  const deductionsArray: Array<{ name?: string; amount?: number | string }> = Array.isArray(loan?.deductions)
    ? (loan.deductions as Array<{ name?: string; amount?: number | string }>)
    : [];
  const findDeductionAmount = (name: string): number => {
    const match = deductionsArray.find((d) => (d?.name ?? "").toLowerCase() === name.toLowerCase());
    return match ? Number(match.amount ?? 0) : 0;
  };
  const loanProcessingFee = findDeductionAmount("Processing Fee");
  const loanServiceFee = findDeductionAmount("Service Fee");
  const loanNotarialFee = findDeductionAmount("Notarial Fee");
  const knownDeductionTotal = loanProcessingFee + loanServiceFee + loanNotarialFee;
  const loanOtherDeductions = Math.max(0, (loan?.total_deductions ?? 0) - knownDeductionTotal);
  const loanReleaseDate = loan?.released_at ?? loan?.start_date ?? loan?.release_date;
  // total_payable from API is computed by summing amortization_schedules. For
  // unreleased loans (draft/for_review/approved) those rows don't exist yet,
  // so the API returns 0 and the server's preview schedule is summed instead.
  // With no server rows at all both figures are unknown and shown as a dash,
  // never projected from the loan's terms; `expectedInterest` is only the
  // Interest Amount of a schedule whose rows carry no interest.
  const expectedInterest =
    Number(loan?.principal_amount ?? 0) * (Number(loan?.interest_rate ?? 0) / 100) * Number(loan?.term ?? 0);
  const loanTotalPayable: number | null =
    Number(loan?.total_payable ?? 0) > 0
      ? Number(loan!.total_payable)
      : storedSchedule.length > 0
        ? storedSchedule.reduce((sum, r) => sum + r.totalPayment, 0)
        : null;
  const loanInterestAmount: number | null =
    storedSchedule.length === 0
      ? null
      : storedScheduleTotals.interest > 0 ? storedScheduleTotals.interest : expectedInterest;

  // Live-preview the repayment allocation as the user types the amount.
  // Mirrors the rich breakdown shown on /payments so cashiers see exactly
  // which schedule periods, principal/interest/penalty/SCB this payment will
  // settle before posting. Must sit ABOVE the early returns below to keep
  // hook order stable across renders.
  useEffect(() => {
    if (!recordPaymentOpen || !loan || !canViewPayments) {
      setPaymentPreview(null);
      return;
    }
    const amt = Number(paymentAmount);
    if (!paymentAmount || !Number.isFinite(amt) || amt <= 0) {
      setPaymentPreview(null);
      return;
    }
    let cancelled = false;
    setPaymentPreviewLoading(true);
    const handle = setTimeout(async () => {
      try {
        const res = await repaymentService.preview(loan.id, {
          amount_paid: amt,
          payment_date: formatDateISO(paymentDate),
        });
        if (!cancelled) setPaymentPreview(res ?? null);
      } catch {
        if (!cancelled) setPaymentPreview(null);
      } finally {
        if (!cancelled) setPaymentPreviewLoading(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [recordPaymentOpen, loan, paymentAmount, paymentDate, canViewPayments]);

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-6rem)] items-center justify-center">
        <Spinner className="size-6 text-muted-foreground" />
      </div>
    );
  }

  if (!loan) {
    return loadFailure?.kind === "failed" ? (
      <LoanLoadFailed message={loadFailure.message} onRetry={reloadLoan} />
    ) : (
      <LoanNotFound />
    );
  }

  // The insurance the release sends, and what the release will then store: the
  // server's preview with that insurance applied the way the server applies
  // it. Null until the preview is in, and Confirm Release stays off until then.
  const releaseInsurance = releaseInsurancePayload(
    Number(loan.principal_amount) || 0,
    insurancePremium,
  );
  const releaseAmounts =
    releasePreview.status === "loaded"
      ? releaseFigures(releasePreview.preview, releaseInsurance)
      : null;
  const canConfirmRelease =
    releaseAmounts !== null && !releaseAmounts.exceedsNetProceeds && !actionLoading;

  const handleRelease = async () => {
    if (releasePreview.status !== "loaded" || !canConfirmRelease) return;
    setActionLoading(true);
    try {
      // The fingerprint of the fees quoted on screen: if they have changed
      // since, the server refuses the release (409) rather than pay out a
      // different amount from the one the cashier just read.
      await loanService.release(loan.id, {
        ...releaseInsurance,
        fee_fingerprint: releasePreview.preview.fee_fingerprint,
      });
    } catch (err) {
      console.error("[release] failed", err instanceof AxiosError ? { status: err.response?.status, data: err.response?.data } : err);
      if (httpStatusOf(err) === 409) {
        // Nothing was released: the fees changed after they were quoted. Quote
        // them again, and the dialog stays open on the new figures.
        notifyError(
          err,
          "We couldn't release this loan. Please try again.",
          "The release figures have been read again. Check them before confirming.",
        );
        reloadReleasePreview();
      } else {
        notifyError(err, "We couldn't release this loan. Please try again.");
      }
      setActionLoading(false);
      return;
    }
    // The loan is released. A failure from here on is only the re-read, and
    // must not read as a failed release: trying again would be refused, the
    // loan no longer being approved.
    //
    // Refetch the full loan detail rather than trusting the PATCH body — the
    // GET endpoint returns the complete server state (deductions including the
    // insurance premium added on release, total_deductions, net_proceeds, and
    // embedded relations). The server-generated schedule, summary, payments,
    // adjustments and ledger are then read once by the effects above, which run
    // when the status enters the released set.
    const reloaded = await loadLoan(loan.id, loan).catch(() => null);
    setActionLoading(false);
    setReleaseOpen(false);
    setInsurancePremium(INSURANCE_PREMIUM_INITIAL);
    toast.success("Loan released");
    // Re-read the chain rather than marking the release step approved here.
    // Releasing is a server-side event; whether it closes the release step is
    // the server's call to record and ours to display.
    void refreshApproval();
    if (reloaded) {
      setLoan(reloaded);
      setAutoPayIsPostRelease(true);
      setAutoPayDialogOpen(true);
    } else {
      notifyWarning("The page couldn't refresh", "Reload to see the released loan.");
    }
  };

  // ── Multi-step approval handlers ──
  //
  // Every one of these calls the API and then re-reads. None of them patch the
  // chain on screen from what they sent or from a response body: the server
  // decides what the chain looks like next, including whether the loan itself
  // moved status, and the only honest way to find out is to ask it.

  // Array POSITION, deliberately NOT `step.index`. `index` is the server's
  // `step_order` — an ordering key, not a guaranteed 0-based offset — so using
  // it to reach a neighbour (`steps[index + 1]`) or to label "Step N of M"
  // breaks silently the moment the server's orders don't start at zero. It is
  // used for exactly one thing: the `target_step_order` a send-back carries.
  const currentStepIndex = approvalSteps.findIndex((s) => s.status === "pending");
  const currentStep = currentStepIndex >= 0 ? approvalSteps[currentStepIndex] : null;
  const nextStep =
    currentStepIndex >= 0 ? approvalSteps[currentStepIndex + 1] ?? null : null;
  // Confirmation step = the last approve step (next step is release). Its button
  // reads "Confirm & Forward" instead of "Approve & Forward" to signal the
  // chairwoman's role as final confirmation before release.
  const isConfirmationStep =
    currentStep?.kind === "approve" && nextStep?.kind === "release";
  const allStepsApproved =
    approvalSteps.length > 0 && approvalSteps.every((s) => s.status === "approved");
  // THE SERVER DECIDES. `can_act` is the same rule the endpoints enforce,
  // evaluated for the requesting user; the client role check is only a fallback
  // for a payload that omits the flag.
  const canActOnCurrentStep = currentStep
    ? currentStep.can_act ?? canUserActOnStep(currentStep, currentUser?.roles)
    : false;
  // Advisory second opinion, used to disable the action buttons before the
  // round trip. It can only ever narrow what `can_act` offers, never widen it.
  const clientCanActOnCurrentStep = currentStep
    ? canUserActOnStep(currentStep, currentUser?.roles)
    : false;

  /**
   * Re-read the loan AND its chain after acting on a step.
   *
   * Both, always. The last `approve` step moves `loans.status` to `approved`
   * server-side, and a send-back opens a new round while leaving the status at
   * `for_review` — neither is something the client can infer from what it sent.
   */
  const refreshAfterStepAction = async () => {
    try {
      const [updated] = await Promise.all([
        loadLoan(loan.id, loan),
        refreshApproval(),
      ]);
      setLoan(updated);
    } catch {
      // Swallowed on purpose. Reaching here means the ACTION succeeded and only
      // the re-read failed; letting this reject would have the caller report a
      // recorded approval as "we couldn't record this approval", which is the
      // one thing an approver must never be told twice.
      notifyWarning(
        "Recorded, but the page couldn't refresh",
        "Reload to see the current step."
      );
    }
  };

  /** Shared guard for the three step actions. Returns false once it has toasted. */
  // A draft whose chain has not been seeded yet: no steps, so no `currentStep`,
  // so every guard keyed on one silently refuses. Submit, Edit and Void all
  // have to remain reachable in this state or the draft is unrecoverable.
  const isUnseededDraft = loan.status === "draft" && approvalSteps.length === 0;

  const assertCanActOnStep = (verb: string): boolean => {
    if (!currentStep) return false;
    if (!canActOnCurrentStep || !clientCanActOnCurrentStep) {
      toast.error(`Only a user with the ${currentStep.role} role can ${verb}`);
      return false;
    }
    return true;
  };

  // Edit Loan Application — available to the Loan Processor while the loan
  // is still a draft OR has been sent back by an approver. The button links
  // to /loans/new?edit={id} so the full New Loan form is used for editing,
  // and saving there is `PUT /loans/{id}`, which needs `loans:update`.
  const canEditLoanApplication =
    canUpdateLoan &&
    !isLocked &&
    !isApprovalChainHidden(loan.status) &&
    (isUnseededDraft ||
      (!!currentStep && currentStep.kind === "submit" && canActOnCurrentStep));

  // Who may send a draft for review: `PATCH /loans/{id}/submit` takes
  // `loans:update`, or `loans:restructure` for a restructure application.
  const canSubmitDraft = canUpdateLoan || (!!loan.is_restructure && canRestructureLoan);

  // Loan Processor's submit step.
  //
  // Two different calls behind one button, chosen on the loan's server status:
  //   * `draft`  → `loanService.submit()`. This is the draft → for_review hop,
  //     and it is what SEEDS the chain server-side. There is no chain to act on
  //     before it runs.
  //   * anything else → the loan is already `for_review` and has been sent back
  //     to this step; the chain exists, so act on the step itself. Calling
  //     `submit()` again would 422.
  const handleStepSubmit = async () => {
    // A never-submitted draft has NO chain — that is the whole point, the
    // chain is seeded by this call — so there is no `currentStep` to check.
    // Guarding on one made the draft Submit button a silent no-op: it
    // rendered, it was enabled, and it returned on the first line.
    //
    // With no step there is no role to compare against. The button is shown
    // only to `canSubmitDraft`, the rule `submit` enforces, and a 403 still
    // surfaces through notifyError like any other failure.
    if (!isUnseededDraft) {
      if (!currentStep || currentStep.kind !== "submit") return;
      if (!assertCanActOnStep("submit the draft")) return;
    }
    try {
      setStepActionLoading(true);
      if (loan.status === "draft") {
        await loanService.submit(loan.id);
      } else {
        await loanApprovalService.approve(loan.id, currentStep!.id, {
          remarks: stepRemarks.trim() || undefined,
        });
      }
      await refreshAfterStepAction();
      setStepRemarks("");
      toast.success("Submitted for review");
    } catch (err) {
      notifyError(err, "We couldn't submit for review. Please try again.");
    } finally {
      setStepActionLoading(false);
    }
  };

  // Approver steps (Manager, BOD1..BODn): Approve & Forward.
  //
  // One call. The server marks the step approved, moves the chain to the next
  // step, and on the LAST approve step takes `loans.status` to `approved` by
  // itself — so this must NOT also call `PATCH /loans/{id}/approve`, which is
  // what the localStorage version did and what would now double-post the approval.
  const handleStepApprove = async () => {
    if (!currentStep || currentStep.kind !== "approve") return;
    if (!assertCanActOnStep("approve this step")) return;
    const actedStepName = currentStep.name;
    const forwardedTo = nextStep?.name;
    try {
      setStepActionLoading(true);
      await loanApprovalService.approve(loan.id, currentStep.id, {
        remarks: stepRemarks.trim() || undefined,
      });
      await refreshAfterStepAction();
      setStepRemarks("");
      toast.success(
        forwardedTo
          ? `Approved by ${actedStepName}. Forwarded to ${forwardedTo}.`
          : `Approved by ${actedStepName}`
      );
    } catch (err) {
      notifyError(err, "We couldn't record this approval. Please try again.");
    } finally {
      setStepActionLoading(false);
    }
  };

  // Approver steps: Send Back for Revision — the flowchart's "Approved? = No".
  //
  // Opens a new round server-side and leaves `loans.status` at `for_review`;
  // the loan goes back on an earlier desk rather than being killed. `remarks`
  // is required by the endpoint, and `targetStepOrder` is a prior step's
  // `index`, not its position in the array.
  const handleStepSendBack = async (targetStepOrder: number) => {
    if (!currentStep || currentStep.kind !== "approve") return;
    if (!assertCanActOnStep("send back this loan")) return;
    const remarks = stepRemarks.trim();
    if (!remarks) {
      toast.error("Please enter a reason before sending back for revision");
      return;
    }
    const targetStep = approvalSteps.find((s) => s.index === targetStepOrder);
    if (!targetStep || targetStep.index >= currentStep.index) {
      toast.error("Invalid send-back target");
      return;
    }
    try {
      setStepActionLoading(true);
      await loanApprovalService.sendBack(loan.id, currentStep.id, {
        target_step_order: targetStep.index,
        remarks,
      });
      await refreshAfterStepAction();
      setStepRemarks("");
      toast.success(
        `${currentStep.name} sent the loan back to ${targetStep.name} for revision.`
      );
    } catch (err) {
      notifyError(err, "We couldn't send this back for revision. Please try again.");
    } finally {
      setStepActionLoading(false);
    }
  };

  // Release step (Cashier / General Bookkeeper): open the existing Release Loan
  // dialog. `handleRelease()` makes the real call and then refreshes the chain.
  const handleStepRelease = () => {
    if (!currentStep || currentStep.kind !== "release") return;
    if (!assertCanActOnStep("release this loan")) return;
    setReleaseOpen(true);
  };

  // ── Repayment Handlers ──

  // Whether the current loan qualifies for "Upon Maturity" extension flows.
  // Mirrors the predicate storedSchedule passes as `isUponMaturity`.
  const isUponMaturityLoan = (() => {
    if (!loan) return false;
    const freq = loan.frequency ?? loan.payment_frequency ?? "";
    return (
      freq === "upon_maturity" ||
      loan.interest_method === "upon_maturity" ||
      loan.interest_type === "upon_maturity"
    );
  })();

  // Loan Extension is offered only on one-month-term loans, whatever the
  // product. The API decides: eligibility depends on the loan's ORIGINAL term,
  // and once an extension is applied `term` no longer describes the loan as
  // agreed — each extension increments it — so this cannot be derived from the
  // payload. Reimplementing it here would hide the button after one use even
  // though the API still allows more.
  const isOneMonthTermLoan = loan?.is_one_month_term ?? false;

  // Posts a payment and, unless `refresh` is false, re-reads what it changed.
  // "Yes, extend" passes false: it extends straight afterwards and re-reads
  // once for both.
  const submitRepayment = async (
    data: {
      payment_date: string;
      amount_paid: number;
      remarks?: string;
    },
    { refresh = true }: { refresh?: boolean } = {},
  ): Promise<boolean> => {
    setActionLoading(true);
    try {
      const repayment = await repaymentService.create(loan.id, data);
      setShareCapitalVersion((v) => v + 1);
      toast.success(
        paymentMode === "advance" ? "Advance payment recorded" : "Payment recorded",
        { action: { label: "View Receipt", onClick: () => router.push(`/payments/${repayment.id}`) } }
      );
      setRecordPaymentOpen(false);
      setPaymentAmount("");
      setPaymentRemarks("");
      setPaymentDate(new Date());
      setPaymentPreview(null);
      setPaymentMode("regular");
      setAdvancePeriods(1);
      // Refresh independently — don't let any single failure block the others
      // or pollute the catch block (payment already succeeded at this point).
      if (refresh) {
        const loanId = loan.id;
        await Promise.allSettled([
          fetchSchedule(loanId),
          fetchLoanSummary(loanId),
          fetchRepayments(loanId),
          loadLoan(loanId, loan).then(setLoan),
        ]);
      }
      return true;
    } catch {
      toast.error("We couldn't record the payment. Please try again.");
      return false;
    } finally {
      setActionLoading(false);
    }
  };

  const handleRecordPayment = async () => {
    if (!paymentAmount || Number(paymentAmount) <= 0) return;
    // Annotate the remarks so the receipt/audit log preserves the
    // cashier's intent. Backend only persists payment_date, amount_paid,
    // and remarks — no dedicated "is_advance" column — so the tag in
    // remarks is the audit trail for advance payments.
    const tag =
      paymentMode === "advance"
        ? `[ADVANCE: ${advancePeriods} period${advancePeriods === 1 ? "" : "s"}]`
        : null;
    const composedRemarks = tag
      ? paymentRemarks.trim()
        ? `${paymentRemarks.trim()}\n${tag}`
        : tag
      : paymentRemarks || undefined;
    const payload = {
      payment_date: formatDateISO(paymentDate),
      amount_paid: Number(paymentAmount),
      remarks: composedRemarks,
    };

    // Upon Maturity loans: if the cashier is recording less than the
    // full amount due for the current period, prompt to extend instead
    // of silently posting a partial payment.
    if (isUponMaturityLoan && paymentMode === "regular") {
      const currentDue = storedSchedule.find((row) => row.status !== "paid");
      if (currentDue && payload.amount_paid < currentDue.totalPayment) {
        setPendingPayment(payload);
        setPartialExtendOpen(true);
        return;
      }
    }

    await submitRepayment(payload);
  };

  // ── Loan Extension Handlers (Upon Maturity) ──

  const handleExtendLoan = async () => {
    setActionLoading(true);
    try {
      // The API collects the interest itself when "pay" is chosen, in the same
      // transaction as the extension. That replaced a client-side repayment
      // call followed by extend(): if the extend failed, the payment was
      // already committed, and the only thing stopping a second charge was a
      // ref that reset whenever this dialog was reopened.
      await loanService.extend(loan.id, {
        remarks: extendRemarks.trim() || undefined,
        interest_option: extendInterestOption,
      });
      toast.success(
        extendInterestOption === "pay"
          ? "Interest collected and loan extended by one cycle"
          : "Loan extended by one cycle — interest carried forward",
      );
      setExtendOpen(false);
      setExtendRemarks("");
    } catch (err) {
      // Nothing was charged: a failed extension rolls the interest payment
      // back with it, so retrying is safe.
      notifyError(err, "We couldn't extend this loan. Please try again.");
    } finally {
      try {
        setLoan(await loadLoan(loan.id, loan));
        await fetchSchedule(loan.id);
        await fetchLoanSummary(loan.id);
        await fetchRepayments(loan.id);
        // Extend always posts a debit (and a credit when "pay" collects the
        // interest) — refresh so the Ledger shows both immediately rather
        // than only after the next full page load.
        await fetchLedgerEntries(loan.id);
        // Refresh the extension/adjustment history too — the effect that loads
        // adjustments only runs when the loan first has server data, so an
        // extension wouldn't trigger it, leaving the history card stale.
        await fetchAdjustments(loan.id);
      } catch {
        // non-fatal — dialog state above already reflects the outcome
      }
      setActionLoading(false);
    }
  };

  const handlePartialExtendConfirm = async () => {
    if (!pendingPayment) return;
    const payload = pendingPayment;
    setPartialExtendOpen(false);
    setPendingPayment(null);
    // Pay first — this posts the cashier's originally-entered amount against
    // the CURRENT period (before it rolls over), then extend. Reversing this
    // order (as the old code did) posted the payment against the already-
    // extended period instead of paying down the period it was meant to settle.
    const paid = await submitRepayment(payload, { refresh: false });
    if (!paid) return;
    setActionLoading(true);
    try {
      await loanService.extend(loan.id, {
        remarks: `Auto-extend on partial payment of ${payload.amount_paid}`,
        // The cashier's payment was just posted on the line above, so the API
        // must not collect interest again — whatever remains unpaid carries
        // into the new period, which is how this flow has always behaved.
        interest_option: "defer",
      });
      toast.success("Loan extended");
    } catch (err) {
      notifyError(err, "We couldn't extend this loan. Please try again.");
    } finally {
      // One re-read for the payment AND the extension: what Extend Loan reads,
      // which covers what the payment changed. Also when the extension fails,
      // because the payment above stands either way.
      await Promise.allSettled([
        loadLoan(loan.id, loan).then(setLoan),
        fetchSchedule(loan.id),
        fetchLoanSummary(loan.id),
        fetchRepayments(loan.id),
        fetchLedgerEntries(loan.id),
        fetchAdjustments(loan.id),
      ]);
      setActionLoading(false);
    }
  };

  const handlePartialExtendDecline = async () => {
    if (!pendingPayment) return;
    const payload = pendingPayment;
    setPartialExtendOpen(false);
    setPendingPayment(null);
    await submitRepayment(payload);
  };

  // ── Auto Pay (Upon Maturity) ──

  const handleAutoPayConfirm = async () => {
    const amount = loanSummary?.outstanding_balance ?? loan.outstanding_balance ?? 0;
    if (!amount || amount <= 0) return;
    setAutoPayProcessing(true);
    try {
      const repayment = await repaymentService.create(loan.id, {
        payment_date: formatDateISO(new Date()),
        amount_paid: amount,
        remarks: "[AUTO PAY]",
      });
      setAutoPayConfirmOpen(false);
      toast.success("Auto pay processed");
      router.push(`/payments/${repayment.id}`);
    } catch {
      toast.error("We couldn't process auto pay. Please try again.");
    } finally {
      setAutoPayProcessing(false);
    }
  };


  const handleVoidRepayment = async (repaymentId: number) => {
    const reason = prompt("Reason for voiding this payment:");
    if (!reason?.trim()) return;
    try {
      setActionLoading(true);
      await repaymentService.void(repaymentId, { void_reason: reason });
      setShareCapitalVersion((v) => v + 1);
      toast.success("Payment voided");
      // A void undoes a payment, so re-read what recording one re-reads.
      // Settled rather than thrown, since the void already stands and a failed
      // re-read must not be reported as a failed void.
      await Promise.allSettled([
        loadLoan(loan.id, loan).then(setLoan),
        fetchSchedule(loan.id),
        fetchLoanSummary(loan.id),
        fetchRepayments(loan.id),
      ]);
    } catch {
      toast.error("We couldn't void the payment. Please try again.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleVoidLoan = async () => {
    try {
      setActionLoading(true);
      await loanService.void(loan.id);
      toast.success("Loan voided");
      // Settled rather than thrown: the void already stands, and a failed
      // re-read must not be reported as a failed void.
      await Promise.allSettled([loadLoan(loan.id, loan).then(setLoan)]);
    } catch {
      toast.error("We couldn't void the loan. Please try again.");
    } finally {
      setActionLoading(false);
    }
  };

  // ── Loan Adjustment Handlers ──

  /** Clear every adjustment field so the next "New Adjustment" starts from scratch. */
  const resetAdjustmentForm = () => {
    setAdjType("balance_adjustment");
    setAdjDescription("");
    setAdjRemarks("");
    resetAdjustmentValueFields();
  };

  /** Clear only the type-specific value fields — used when the type changes mid-form. */
  const resetAdjustmentValueFields = () => {
    setAdjNewBalance("");
    setAdjAdditionalMonths("");
  };

  const handleCreateAdjustment = async () => {
    // Build new_values from user-friendly fields based on type
    const newValues: Record<string, unknown> = {};
    if (adjType === "balance_adjustment") {
      if (!adjNewBalance) { toast.error("Please enter the new balance amount"); return; }
      const target = parseFloat(adjNewBalance);
      if (!Number.isFinite(target) || target < 0) { toast.error("Enter a valid new balance"); return; }
      // The API takes a signed delta applied to the principal
      // (`adjustment_amount`), not the resulting balance. The dialog asks for
      // the balance the user wants, so convert it here.
      const current = loanSummary?.outstanding_balance ?? loan.outstanding_balance ?? 0;
      const delta = Number((target - current).toFixed(2));
      if (delta === 0) { toast.error("That is already the outstanding balance"); return; }
      newValues.adjustment_amount = delta;
    } else if (adjType === "penalty_waiver") {
      // The API waives a schedule's penalty in full — there is no partial
      // amount waiver — so it takes `waive_all` or a list of `schedule_ids`,
      // never a peso figure. Sending an amount used to leave the handler with
      // no selection at all, which waived the penalty on *every* open schedule.
      newValues.waive_all = true;
    } else if (adjType === "term_extension") {
      const extraWhat = extendsByMonth ? "months" : "instalments";
      if (!adjAdditionalMonths) { toast.error(`Please enter the additional ${extraWhat}`); return; }
      const extraMonths = parseInt(adjAdditionalMonths);
      if (!Number.isFinite(extraMonths) || extraMonths < 1) { toast.error(`Additional ${extraWhat} must be at least 1`); return; }
      // `additional_terms` is the number of extra periods, not the resulting
      // term — `term` is the restructure field and is ignored here.
      newValues.additional_terms = extraMonths;
    }
    try {
      setActionLoading(true);
      await loanAdjustmentService.create(loan.id, {
        adjustment_type: adjType,
        new_values: newValues,
        description: adjDescription || undefined,
        remarks: adjRemarks || undefined,
      });
      toast.success("Adjustment created");
      setCreateAdjustmentOpen(false);
      resetAdjustmentForm();
      fetchAdjustments(loan.id);
    } catch (err) {
      notifyError(err, "We couldn't create the adjustment. Please try again.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleAdjustmentAction = async (adjId: number, action: "approve" | "reject" | "apply") => {
    try {
      setActionLoading(true);
      if (action === "approve") {
        const remarks = prompt("Approval remarks (optional):");
        await loanAdjustmentService.approve(adjId, { remarks: remarks || undefined });
        toast.success("Adjustment approved");
      } else if (action === "reject") {
        const remarks = prompt("Rejection remarks:");
        if (!remarks?.trim()) return;
        await loanAdjustmentService.reject(adjId, { remarks });
        toast.success("Adjustment rejected");
      } else {
        await loanAdjustmentService.apply(adjId);
        toast.success("Adjustment applied");
        // Applying rewrites the loan's open schedule rows, and with them its
        // balances; it posts no payments and no ledger entries. Settled rather
        // than thrown: a failed re-read is not a failed apply.
        await Promise.allSettled([
          loadLoan(loan.id, loan).then(setLoan),
          fetchSchedule(loan.id),
          fetchLoanSummary(loan.id),
        ]);
      }
      fetchAdjustments(loan.id);
    } catch {
      toast.error(`We couldn't ${action} the adjustment. Please try again.`);
    } finally {
      setActionLoading(false);
    }
  };

  // ── Statement of Account ──
  const handleOpenStatementOfAccount = async () => {
    if (!loan) return;
    setSoaOpen(true);
    setSoaLoading(true);
    setSoaData(null);
    try {
      const res = await reportService.statementOfAccount(loan.id);
      const payload = (res && typeof res === "object" && "data" in (res as Record<string, unknown>)
        ? (res as { data: unknown }).data
        : res) as Record<string, unknown> | null;
      setSoaData(payload ?? {});
    } catch {
      toast.error("We couldn't load the statement of account. Please try again.");
      setSoaData(null);
    } finally {
      setSoaLoading(false);
    }
  };

  // ── Printable documents ──
  //
  // Every document below is built by the shared printables catalog — the same
  // builders `/printables` uses — so a template fix reaches this page without a
  // second implementation to keep in step.
  //
  // What used to sit here was an API call guarded on `apiData.borrower_name`, a
  // key the disclosure/promissory-note endpoints have never returned, plus a
  // ~120-line inline reconstruction of the loan for when that guard "failed".
  // The guard was always false, so the reconstruction was the only path that
  // ever ran. The catalog's builders degrade to a blank, printable form on a
  // failed request, which is that failsafe done once and tested.

  // A release voucher records a disbursement that has happened, and a demand
  // letter presupposes arrears. Outside those states the entry is shown but
  // disabled with the reason on it — hiding it only makes staff hunt for it.
  const isDisbursed = hasServerLoanData;
  const isInArrears =
    loan.status === "past_due" ||
    loan.status === "defaulted" ||
    (loanSummary?.overdue_amount ?? 0) > 0;
  const printUnavailable: Partial<Record<PrintableId, string>> = {
    ...(isDisbursed
      ? {}
      : { release_voucher: "Available once the loan is released" }),
    ...(isInArrears
      ? {}
      : { demand_letter: "Available once the loan falls past due" }),
  };

  const totalDeductions = loan.total_deductions ?? (loanProcessingFee + loanServiceFee + (loanOtherDeductions > 0 ? loanOtherDeductions : 0));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <Link
          href="/loans"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Loans
        </Link>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            {loan.loan_account_number && (
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-xl font-bold text-brand-orange">
                  {loan.loan_account_number}
                </span>
                <Badge
                  variant="outline"
                  className={cn("text-sm px-3 py-1", LOAN_STATUS_COLORS[loan.status])}
                >
                  {LOAN_STATUS_LABELS[loan.status] ?? loan.status}
                </Badge>
              </div>
            )}
            <div className="flex items-center gap-3 flex-wrap">
              <span className={cn(
                "font-mono font-semibold",
                loan.loan_account_number ? "text-sm text-muted-foreground" : "text-lg text-brand-orange"
              )}>
                {loan.application_number}
              </span>
              {!loan.loan_account_number && (
                <Badge
                  variant="outline"
                  className={cn("text-sm px-3 py-1", LOAN_STATUS_COLORS[loan.status])}
                >
                  {LOAN_STATUS_LABELS[loan.status] ?? loan.status}
                </Badge>
              )}
            </div>
            <p className="text-lg text-foreground">{loanBorrowerName}</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:self-start">
            {isOneMonthTermLoan &&
              ["released", "ongoing", "current", "past_due"].includes(loan.status) &&
              (loanSummary?.outstanding_balance ?? loan.outstanding_balance ?? 0) > 0 && (
                <Button
                  onClick={() => setExtendOpen(true)}
                  className="w-full sm:w-auto bg-brand-blue text-brand-blue-foreground shadow-sm hover:bg-brand-blue-dark hover:shadow-md transition-all"
                >
                  <CalendarPlus className="mr-2 h-4 w-4" />
                  Extend Loan
                </Button>
              )}
          </div>
        </div>
      </div>


      <LoanCollateralsCard
        loanId={loan.id}
        loanPrincipal={Number(loan.principal_amount ?? 0)}
      />

      {/* The chain is over for `rejected` and `void` loans — a voided draft used
          to keep rendering its orphaned chain, complete with a "pending" step on
          a loan struck from the record. While the chain is loading or
          unreadable the card still renders, saying which: an empty card would
          read as "nobody has approved anything". */}
      {!isApprovalChainHidden(loan.status) &&
        (approvalLoading ||
          approvalUnavailable ||
          approvalSteps.length > 0 ||
          // A DRAFT has no chain yet — it is seeded on submit — but the only
          // "Submit for Review" control lives inside this card, so suppressing
          // it here left a draft with no way into the chain at all: the chain
          // seeds on submit, and submit needed the chain. Any draft not
          // auto-submitted by /loans/new was unrecoverable.
          loan.status === "draft" ||
          // Past draft the rows should exist. Empty here means they are
          // missing, not unwritten — say so rather than rendering nothing,
          // which reads as "this loan has no approval process".
          loanShouldHaveAChain(loan.status)) && (
        <Collapsible open={approvalStepsOpen} onOpenChange={setApprovalStepsOpen}>
          <Card>
            <CardHeader className="cursor-pointer select-none hover:bg-muted/30 transition-colors">
              <CollapsibleTrigger className="w-full text-left group/trigger">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                  Loan Approval Process
                  <Badge variant="outline" className="text-xs font-normal">
                    {approvalLoading
                      ? "Loading..."
                      : approvalUnavailable
                        ? "Unavailable"
                        : allStepsApproved
                          ? "Complete"
                          : currentStep
                            ? `Step ${currentStepIndex + 1} of ${approvalSteps.length}`
                            : approvalSteps.length === 0
                              ? loan.status === "draft"
                                ? "Not submitted"
                                : "No steps found"
                              : `${approvalSteps.length} steps`}
                  </Badge>
                  <ChevronDown className="ml-auto h-4 w-4 text-muted-foreground transition-transform group-aria-expanded/trigger:rotate-180 shrink-0" />
                </CardTitle>
              </CollapsibleTrigger>
              {approvalRounds.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  Revision {approvalRounds.length + 1} — previously sent back{" "}
                  {approvalRounds.length} time{approvalRounds.length !== 1 ? "s" : ""}
                </p>
              )}
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="space-y-5">
            {approvalLoading && (
              <div
                className="flex items-center gap-2 text-xs text-muted-foreground"
                role="status"
                aria-live="polite"
              >
                <Spinner className="h-4 w-4" />
                Loading the approval chain&hellip;
              </div>
            )}

            {/* The read failed — 404 while the endpoint is still shipping, or a
                loan whose chain was never seeded. Says so rather than drawing a
                chain from `loans.status`: a chain assembled in the browser is a
                claim about who signed off that nobody can check, which is the
                whole reason this moved off localStorage. */}
            {!approvalLoading && approvalUnavailable && (
              <div className="rounded-lg border border-dashed bg-muted/30 p-3 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="text-xs">
                  <p className="font-medium">Approval chain unavailable</p>
                  <p className="text-muted-foreground mt-0.5">
                    We couldn&rsquo;t load the approval steps for this loan. Reload the
                    page to try again — approvals are recorded on the server, so
                    nothing has been lost.
                  </p>
                </div>
              </div>
            )}

            {/* A draft has no chain yet — it is seeded on submit — so this is
                the one place Submit for Review can live. It used to sit inside
                the active-step panel, which needs a `currentStep` that a draft
                by definition does not have, so the card was suppressed and the
                loan had no way in. */}
            {!approvalLoading && !approvalUnavailable && approvalSteps.length === 0
              && loan.status === "draft" && (
              <div className="rounded-lg border border-dashed bg-muted/30 p-3 space-y-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="text-xs">
                    <p className="font-medium">Not yet submitted</p>
                    <p className="text-muted-foreground mt-0.5">
                      The approval chain is created when this loan is submitted for
                      review. Nobody can sign off on it until then.
                    </p>
                  </div>
                </div>
                {/* Void and Edit live in the submit-step panel below, which a
                    never-submitted draft never reaches — so without these the
                    draft could not be submitted, edited OR voided from its own
                    page. */}
                <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                  {canVoidLoan && (
                    <Button
                      variant="destructive"
                      size="sm"
                      className="w-full sm:w-auto"
                      disabled={actionLoading}
                      onClick={handleVoidLoan}
                    >
                      <Ban className="mr-2 h-4 w-4" />
                      Void Loan
                    </Button>
                  )}
                  {canEditLoanApplication && loan && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full sm:w-auto"
                      disabled={stepActionLoading}
                      nativeButton={false}
                      render={<Link href={`/loans/new?edit=${loan.id}`} />}
                    >
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit Loan Application
                    </Button>
                  )}
                  {canSubmitDraft && (
                    <Button
                      size="sm"
                      className="w-full sm:w-auto bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark"
                      disabled={stepActionLoading}
                      onClick={handleStepSubmit}
                    >
                      {stepActionLoading ? "Submitting…" : "Submit for Review"}
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Past draft, the rows should already exist. Empty means missing,
                not unwritten. The server answers 200 with empty arrays either
                way, so the hook cannot tell them apart — the loan's own status
                is what distinguishes them. */}
            {!approvalLoading && !approvalUnavailable && approvalSteps.length === 0
              && loanShouldHaveAChain(loan.status) && (
              <div className="rounded-lg border border-dashed bg-muted/30 p-3 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="text-xs">
                  <p className="font-medium">Approval chain unavailable</p>
                  <p className="text-muted-foreground mt-0.5">
                    This loan is {LOAN_STATUS_LABELS[loan.status] ?? loan.status}, but its approval
                    steps could not be found. Approvals are recorded on the server —
                    ask an administrator to check this loan rather than re-approving
                    it.
                  </p>
                </div>
              </div>
            )}

            {/* Horizontal progress tracker — every step at a glance.
                The step awaiting action is marked with an orange ring. */}
            {approvalSteps.length > 0 && (
            <div className="rounded-lg border bg-muted/20 p-3">
              <div className="flex items-center gap-1 overflow-x-auto pb-1">
                {approvalSteps.map((step, i) => {
                  const isCurrent = step.status === "pending";
                  const isDone = step.status === "approved";
                  const isSentBack = step.status === "sent_back";
                  const isLast = i === approvalSteps.length - 1;
                  return (
                    <div
                      key={`mini-${step.index}`}
                      className="flex items-center shrink-0"
                    >
                      <div className="flex flex-col items-center gap-1 min-w-[68px]">
                        <div
                          className={cn(
                            "h-7 w-7 rounded-full flex items-center justify-center shrink-0 text-white text-[10px] font-semibold transition-all",
                            isCurrent && "bg-brand-orange ring-4 ring-brand-orange/20 scale-110",
                            isDone && "bg-green-600",
                            isSentBack && "bg-red-500",
                            !isCurrent && !isDone && !isSentBack && "bg-muted text-muted-foreground"
                          )}
                        >
                          {isDone ? (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          ) : isSentBack ? (
                            <XCircle className="h-3.5 w-3.5" />
                          ) : isCurrent ? (
                            step.kind === "submit" ? (
                              <Send className="h-3.5 w-3.5" />
                            ) : step.kind === "release" ? (
                              <Unlock className="h-3.5 w-3.5" />
                            ) : (
                              <Clock className="h-3.5 w-3.5" />
                            )
                          ) : (
                            <span>{i + 1}</span>
                          )}
                        </div>
                        <span
                          className={cn(
                            "text-[10px] text-center leading-tight font-medium",
                            isCurrent && "text-brand-orange",
                            isDone && "text-green-700",
                            isSentBack && "text-red-700",
                            !isCurrent && !isDone && !isSentBack && "text-muted-foreground"
                          )}
                        >
                          {step.name}
                        </span>
                      </div>
                      {!isLast && (
                        <div
                          className={cn(
                            "h-0.5 w-4 mx-0.5 shrink-0 transition-colors",
                            isDone ? "bg-green-600" : "bg-muted"
                          )}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            )}

            {/* Previous revision rounds (collapsed summary) */}
            {approvalRounds.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Previous Revisions
                </p>
                {approvalRounds.map((round) => (
                  <div
                    key={round.round}
                    className="rounded-lg border border-dashed bg-muted/30 p-3"
                  >
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                        Round {round.round}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        Sent back by {round.sent_back_by} ·{" "}
                        {formatDateTime(round.sent_back_at)}
                      </span>
                    </div>
                    <p className="text-xs italic text-muted-foreground pl-2 border-l-2 border-red-400/40 mb-2">
                      &ldquo;{round.sent_back_remarks}&rdquo;
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {round.steps
                        .filter((s) => s.status === "approved" || s.status === "sent_back")
                        .map((s) => (
                          <Badge
                            key={s.index}
                            variant="outline"
                            className={cn(
                              "text-[10px] h-4 px-1.5",
                              s.status === "approved"
                                ? "bg-green-500/10 text-green-700 border-green-500/30"
                                : "bg-red-500/10 text-red-700 border-red-500/30"
                            )}
                          >
                            {s.status === "approved" ? "✓" : "✗"} {s.name}
                          </Badge>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {/* Current step action panel — matches the original screenshot
                design. Phase header (DRAFT / APPROVAL CHAIN / RELEASE) above,
                then the orange-bordered step card with inline "You are acting
                as X" section, remarks textarea, and action buttons. */}
            {currentStep && canActOnCurrentStep && (
              <div>
                {/* Phase header */}
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    {currentStep.kind === "submit"
                      ? "Draft Preparation"
                      : currentStep.kind === "release"
                        ? "Release"
                        : "Approval Chain"}
                  </p>
                  <div className="flex-1 h-px bg-border" />
                </div>

                {/* Step card with orange border */}
                <div className="rounded-lg border border-brand-orange/40 bg-brand-orange/5 overflow-hidden">
                  {/* Header row */}
                  <div className="flex items-center gap-3 p-3">
                    <div className="h-9 w-9 rounded-full bg-brand-orange text-white flex items-center justify-center shrink-0">
                      {currentStep.kind === "submit" ? (
                        <Send className="h-4 w-4" />
                      ) : currentStep.kind === "release" ? (
                        <Unlock className="h-4 w-4" />
                      ) : (
                        <Clock className="h-4 w-4" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold">{currentStep.name}</p>
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0 h-4 bg-brand-orange/10 text-brand-orange border-brand-orange/30"
                        >
                          Pending your action
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="h-px bg-brand-orange/20" />

                  {/* Action body */}
                  <div className="p-4 space-y-3">
                    <div>
                      <p className="text-xs font-semibold">
                        You are acting as{" "}
                        <span className="text-brand-orange">{currentStep.name}</span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Signed in as {currentUserDisplayName}
                        {currentStep.kind === "submit" &&
                          " — submit the draft to forward it to the Manager for approval."}
                        {currentStep.kind === "approve" &&
                          (!isConfirmationStep && nextStep
                            ? ` — on approve, the loan will be forwarded to ${
                                nextStep.name
                              }.${
                                sendBackTargets.length > 1
                                  ? " You may send it back to any earlier step for revision."
                                  : " Send back for revision to return it to the Loan Processor."
                              }`
                            : ` — this is the final approver. Approve to forward for release${
                                sendBackTargets.length > 1
                                  ? ", or send the loan back to any earlier step for revision."
                                  : "."
                              }`)}
                        {currentStep.kind === "release" &&
                          " — open the release dialog to complete the loan release."}
                      </p>
                      {!clientCanActOnCurrentStep && (
                        <p
                          className="text-xs text-amber-700 dark:text-amber-400 mt-1"
                          role="status"
                        >
                          Your signed-in roles don&rsquo;t include{" "}
                          <span className="font-mono bg-muted px-1 py-0.5 rounded">
                            {currentStep.role}
                          </span>
                          , so the actions below are disabled. Sign in again if your
                          access changed recently.
                        </p>
                      )}
                    </div>

                    {currentStep.kind !== "release" && (
                      <div className="space-y-1.5">
                        <Label htmlFor="current-step-remarks" className="text-xs">
                          {currentStep.kind === "submit"
                            ? "Processing notes (optional)"
                            : "Remarks"}{" "}
                          <span className="text-muted-foreground font-normal">
                            {currentStep.kind === "approve"
                              ? "(required for send-back)"
                              : ""}
                          </span>
                        </Label>
                        <Textarea
                          id="current-step-remarks"
                          placeholder={
                            currentStep.kind === "submit"
                              ? "Any notes for the approvers..."
                              : `${currentStep.name}: enter your remarks...`
                          }
                          value={stepRemarks}
                          onChange={(e) => setStepRemarks(e.target.value)}
                          className="min-h-[80px] text-sm bg-background"
                        />
                      </div>
                    )}

                    <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                      {currentStep.kind === "submit" && (
                        <>
                          {canVoidLoan && (
                            <Button
                              variant="destructive"
                              size="sm"
                              className="w-full sm:w-auto"
                              disabled={actionLoading}
                              onClick={handleVoidLoan}
                            >
                              <Ban className="mr-2 h-4 w-4" />
                              Void Loan
                            </Button>
                          )}
                          {canEditLoanApplication && loan && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full sm:w-auto"
                              disabled={stepActionLoading}
                              nativeButton={false}
                              render={<Link href={`/loans/new?edit=${loan.id}`} />}
                            >
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit Loan Application
                            </Button>
                          )}
                          <Button
                            size="sm"
                            className="w-full sm:w-auto bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark"
                            onClick={handleStepSubmit}
                            disabled={stepActionLoading || !clientCanActOnCurrentStep}
                          >
                            <Send className="mr-2 h-4 w-4" />
                            Submit for Review
                          </Button>
                        </>
                      )}
                      {currentStep.kind === "approve" && (
                        <>
                          {sendBackTargets.length > 1 && (
                            <div className="flex items-center gap-2 w-full sm:w-auto">
                              <Label
                                htmlFor="send-back-target"
                                className="text-xs text-muted-foreground whitespace-nowrap"
                              >
                                Send back to
                              </Label>
                              <Select
                                items={sendBackTargetItems}
                                value={String(sendBackTargetIndex)}
                                onValueChange={(v) =>
                                  setSendBackTargetIndex(Number(v))
                                }
                                disabled={stepActionLoading}
                              >
                                <SelectTrigger
                                  id="send-back-target"
                                  className="h-9 w-full sm:w-[180px] text-xs"
                                >
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {sendBackTargets.map((t) => (
                                    <SelectItem
                                      key={t.index}
                                      value={String(t.index)}
                                    >
                                      {t.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full sm:w-auto border-red-500/30 text-red-700 hover:bg-red-50 dark:text-red-400"
                            onClick={() =>
                              handleStepSendBack(
                                sendBackTargets.length > 1
                                  ? sendBackTargetIndex
                                  : sendBackTargets[0]?.index ?? 0
                              )
                            }
                            disabled={
                              stepActionLoading ||
                              !stepRemarks.trim() ||
                              !clientCanActOnCurrentStep ||
                              sendBackTargets.length === 0
                            }
                          >
                            <XCircle className="mr-2 h-4 w-4" />
                            Send Back for Revision
                          </Button>
                          <Button
                            size="sm"
                            className="w-full sm:w-auto bg-green-600 text-white hover:bg-green-700"
                            onClick={handleStepApprove}
                            disabled={stepActionLoading || !clientCanActOnCurrentStep}
                          >
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            {isConfirmationStep ? "Confirm & Forward" : "Approve & Forward"}
                          </Button>
                        </>
                      )}
                      {currentStep.kind === "release" && (
                        <Button
                          size="sm"
                          className="w-full sm:w-auto bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark"
                          onClick={handleStepRelease}
                          disabled={stepActionLoading || !clientCanActOnCurrentStep}
                        >
                          <Unlock className="mr-2 h-4 w-4" />
                          Release Loan
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* "Not your turn" message — current step exists but current user lacks the required role */}
            {currentStep && !canActOnCurrentStep && (
              <div className="rounded-lg border bg-muted/40 p-3">
                <div className="flex items-start gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="text-xs">
                    <p className="font-medium">
                      Waiting for {currentStep.name}{" "}
                      {currentStep.kind === "submit"
                        ? "to submit the draft"
                        : currentStep.kind === "release"
                          ? "to release the loan"
                          : "to approve"}
                    </p>
                    <p className="text-muted-foreground mt-0.5">
                      Only users with the{" "}
                      <span className="font-mono bg-muted px-1 py-0.5 rounded">
                        {currentStep.role}
                      </span>{" "}
                      role can act on this step. You are signed in as{" "}
                      {currentUserDisplayName}
                      {currentUser?.roles && currentUser.roles.length > 0
                        ? ` (${currentUser.roles.join(", ")})`
                        : " (no role assigned)"}
                      .
                    </p>
                  </div>
                </div>
              </div>
            )}

            {allStepsApproved && (
              <div className="rounded-lg border border-green-200 bg-green-50 p-3 flex items-start gap-2 dark:border-green-800/40 dark:bg-green-900/10">
                <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                <p className="text-sm text-green-700 dark:text-green-400">
                  All approvers have signed off. The loan is ready for release.
                </p>
              </div>
            )}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {loan.status === "rejected" && (
        <Card>
          <CardContent className="pt-6">
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Ban className="h-5 w-5 text-red-600" />
                <span className="font-semibold text-red-700">
                  Loan Rejected
                </span>
              </div>
              <p className="text-sm text-red-600">
                Rejected by{" "}
                <span className="font-medium">{loan.rejected_by ?? "—"}</span> on{" "}
                {loan.rejected_at ? formatDateTime(loan.rejected_at) : "N/A"}
              </p>
              {loan.rejection_remarks && (
                <p className="text-sm text-red-600 italic">
                  &ldquo;{loan.rejection_remarks}&rdquo;
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Policy Exception Banner */}
      {loan.policy_exception && (
        <Card className="border-amber-300 bg-amber-50/50 dark:border-amber-700 dark:bg-amber-900/10">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-amber-700 dark:text-amber-400">Policy Exception</span>
                  <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-500/30 text-xs">
                    Full BOD Approval Required
                  </Badge>
                </div>
                {loan.policy_exception_details && (
                  <p className="text-sm text-amber-700/80 dark:text-amber-300/80">
                    {loan.policy_exception_details}
                  </p>
                )}
                {loan.policy_exception_letter && (
                  <a
                    href={loan.policy_exception_letter}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-brand-orange hover:underline"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    View Policy Exception Letter
                  </a>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loan Details Cards */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Card 1: Loan Information */}
        <CollapsibleCard
          title="Loan Information"
          icon={<FileText className="h-4 w-4 text-muted-foreground" />}
          contentClassName="space-y-4"
        >
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">
                  Application Number
                </p>
                <p className="text-sm font-medium font-mono">
                  {loan.application_number}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Loan Product</p>
                <p className="text-sm font-medium">
                  {loanProductName || "N/A"}
                </p>
              </div>
              {loan.purpose && (
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground">Purpose</p>
                  <p className="text-sm font-medium">{loan.purpose}</p>
                </div>
              )}
            </div>

            <Separator />

            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  Principal Amount
                  {isLocked && <Lock className="h-3 w-3 text-muted-foreground" />}
                </p>
                <p className="text-sm font-semibold">
                  {formatCurrency(loan.principal_amount)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  Interest Amount
                  {isLocked && <Lock className="h-3 w-3 text-muted-foreground" />}
                </p>
                <p className="text-sm font-semibold">
                  {loanInterestAmount === null ? "—" : formatCurrency(loanInterestAmount)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  Interest Rate
                  {isLocked && <Lock className="h-3 w-3 text-muted-foreground" />}
                </p>
                <p className="text-sm font-medium">{formatRate(loan.interest_rate)}%</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  Interest Type
                  {isLocked && <Lock className="h-3 w-3 text-muted-foreground" />}
                </p>
                <p className="text-sm font-medium capitalize">
                  {loanInterestType || "N/A"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  Term
                  {isLocked && <Lock className="h-3 w-3 text-muted-foreground" />}
                </p>
                <p className="text-sm font-medium">
                  {loanTermLabel}
                </p>
              </div>
              {(loan.scb_amount ?? 0) > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground">
                    Share Capital Build-Up
                  </p>
                  <p className="text-sm font-semibold">
                    {storedSchedule.length > 0
                      ? formatCurrency(storedScheduleTotals.shareCapitalBuildUp)
                      : "—"}
                  </p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground">
                  Payment Frequency
                </p>
                <p className="text-sm font-medium">
                  {(PAYMENT_FREQUENCY_LABELS[loanFrequency as keyof typeof PAYMENT_FREQUENCY_LABELS] ?? loanFrequency) || "N/A"}
                </p>
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Total Payable</p>
                <p className="text-sm font-semibold">
                  {loanTotalPayable === null ? "—" : formatCurrency(loanTotalPayable)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Net Proceeds</p>
                <p className="text-sm font-semibold">
                  {releasePreviewOnCard
                    ? releasePreview.status === "loaded"
                      ? formatCurrencyExact(releasePreview.preview.net_proceeds)
                      : "—"
                    : loan.net_proceeds != null
                      ? formatCurrency(loan.net_proceeds)
                      : "N/A"}
                </p>
                {loan.status === "approved" && !canReleaseLoan && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Fees configured in Settings are added when the loan is released.
                  </p>
                )}
              </div>
            </div>

            <Separator />

            {/* Deductions */}
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Deductions</p>
              {/* Awaiting release: what the release will withhold, as the
                  server's release preview has it (the Release dialog's figures). */}
              {releasePreviewOnCard ? (
                releasePreview.status === "loaded" ? (
                  releasePreview.preview.deductions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No fees will be withheld.</p>
                  ) : releasePreview.preview.deductions.map((item, index) => (
                    <div key={`${item.name}-${index}`} className="flex items-center justify-between gap-4">
                      <span className="text-sm text-muted-foreground">
                        {item.name}
                        {item.fee_id != null && <span className="ml-1.5 text-xs">from Fees settings</span>}
                      </span>
                      <span className="text-sm font-medium">{formatCurrencyExact(item.amount)}</span>
                    </div>
                  ))
                ) : releasePreview.status === "loading" ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Spinner className="size-4" />
                    Getting the release figures…
                  </div>
                ) : (
                  <p role="alert" className="text-sm text-destructive">{releasePreview.message}</p>
                )
              ) : (() => {
                // Render every backend-computed deduction as its own line —
                // including configured fees like "Insurance Premium" — so
                // product-specific fees aren't silently folded into "Other".
                const named = deductionsArray
                  .filter((d) => (d?.name ?? "").trim() && Number(d.amount ?? 0) !== 0)
                  .map((d) => ({ label: d.name as string, amount: Number(d.amount ?? 0) }));
                const namedTotal = named.reduce((s, r) => s + r.amount, 0);
                const other = Math.max(0, (loan.total_deductions ?? 0) - namedTotal);
                const rows = named.length > 0
                  ? named
                  : [
                      { label: "Processing Fee", amount: loanProcessingFee },
                      { label: "Service Fee", amount: loanServiceFee },
                    ];
                return (
                  <>
                    {rows.map((r) => (
                      <div key={r.label} className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">{r.label}</span>
                        <span className="text-sm font-medium">{formatCurrency(r.amount)}</span>
                      </div>
                    ))}
                    {other > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Other Deductions</span>
                        <span className="text-sm font-medium">{formatCurrency(other)}</span>
                      </div>
                    )}
                  </>
                );
              })()}
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">Total Deductions</span>
                <span className="text-sm font-semibold">
                  {releasePreviewOnCard
                    ? releasePreview.status === "loaded"
                      ? formatCurrencyExact(releasePreview.preview.total_deductions)
                      : "—"
                    : formatCurrency(totalDeductions)}
                </span>
              </div>
            </div>
        </CollapsibleCard>

        {/* Card 2: Borrower's Active Loans */}
        <BorrowerActiveLoans
          loans={borrowerLoans}
          loading={borrowerLoansLoading}
          truncated={borrowerLoansTruncated}
          approvalSteps={approvalSteps}
          loanStatus={loan.status}
          loan={loan}
        />

        {/* Card 3: Member & Co-Maker */}
        <Collapsible open={memberCoMakerOpen} onOpenChange={setMemberCoMakerOpen}>
          <Card>
            <CardHeader className="cursor-pointer select-none hover:bg-muted/30 transition-colors">
              <CollapsibleTrigger className="w-full text-left group/trigger">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-muted-foreground" />
                  Member & Co-Maker
                  <ChevronDown className="ml-auto h-4 w-4 text-muted-foreground transition-transform group-aria-expanded/trigger:rotate-180 shrink-0" />
                </CardTitle>
              </CollapsibleTrigger>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="space-y-4">
            <div>
              <p className="text-xs text-muted-foreground">Member</p>
              <p className="text-sm font-medium">
                {loanBorrowerName || "N/A"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">
                Co-Maker{loanCoMakers.length > 1 ? "s" : ""}
              </p>
              {loanCoMakers.length === 0 ? (
                <p className="text-sm font-medium">None</p>
              ) : (
                <ul className="space-y-0.5">
                  {loanCoMakers.map((cm) => (
                    <li key={cm.id} className="text-sm font-medium">
                      {coMakerName(cm) || "—"}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <Separator />
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-muted-foreground">Account Officer (AO)</p>
                {!aoEditing && canUpdateLoan && (
                  <button
                    type="button"
                    onClick={() => setAoEditing(true)}
                    className="text-xs text-brand-orange hover:underline flex items-center gap-1"
                  >
                    <Pencil className="h-3 w-3" />
                    {loan.account_officer_id ? "Change" : "Assign"}
                  </button>
                )}
              </div>
              {aoEditing ? (
                <div className="space-y-2">
                  <StaffPicker
                    aria-label="Account officer"
                    value={loan.account_officer ?? null}
                    onChange={(officer) => {
                      if (officer) handleSaveAO(officer.id);
                    }}
                    disabled={aoSaving}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setAoEditing(false)}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <p className="text-sm font-medium">
                  {loan.account_officer?.full_name ?? "Not assigned"}
                </p>
              )}
            </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Share Capital — current balance for the loan's member */}
        <ShareCapitalCard
          borrowerId={loan.borrower?.id ?? loan.borrower_id ?? null}
          version={shareCapitalVersion}
        />

        {/* Auto-Pay Status Card */}
        {["released", "current"].includes(loan.status) && (
          <CollapsibleCard
            title="Auto-Pay"
            headerExtra={
              loan.auto_pay_enabled ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 dark:border-blue-800 dark:bg-blue-950/20 dark:text-blue-300">
                  ● Enabled
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-2.5 py-0.5 text-xs text-muted-foreground">
                  ○ Disabled
                </span>
              )
            }
            contentClassName="space-y-3 text-sm"
          >
              {loan.auto_pay_enabled && (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">CBS Reference</span>
                    <span className="font-mono font-medium">
                      {loan.auto_pay_cbs_reference ?? "—"}
                    </span>
                  </div>
                  {loan.auto_pay_enabled_at && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Enabled on</span>
                      <span>{formatDate(loan.auto_pay_enabled_at)}</span>
                    </div>
                  )}
                </>
              )}
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => {
                  setAutoPayIsPostRelease(false);
                  setAutoPayDialogOpen(true);
                }}
              >
                {loan.auto_pay_enabled ? "Disable Auto-Pay" : "Enable Auto-Pay"}
              </Button>
          </CollapsibleCard>
        )}

        {/* Card 4: Workflow History */}
        <Collapsible open={workflowHistoryOpen} onOpenChange={setWorkflowHistoryOpen}>
          <Card>
            <CardHeader className="cursor-pointer select-none hover:bg-muted/30 transition-colors">
              <CollapsibleTrigger className="w-full text-left group/trigger">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  Workflow History
                  <ChevronDown className="ml-auto h-4 w-4 text-muted-foreground transition-transform group-aria-expanded/trigger:rotate-180 shrink-0" />
                </CardTitle>
              </CollapsibleTrigger>
            </CardHeader>
            <CollapsibleContent>
              <CardContent>
                <WorkflowHistory loan={loan} />
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      </div>

      {/* Release Details — only for released+ loans */}
      {isLocked && loan.release_date && (
        <CollapsibleCard
          icon={<Unlock className="h-4 w-4 text-cyan-600" />}
          title={
            <>
              Release Details
              {loanSummary && (
                <Badge variant="outline" className="text-[10px] bg-green-500/10 text-green-700 border-green-500/30">
                  Server-verified
                </Badge>
              )}
            </>
          }
          headerExtra={
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenStatementOfAccount}
            >
              <FileText className="mr-2 h-4 w-4" />
              Statement of Account
            </Button>
          }
        >
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
                  {(() => {
                    // Upon-maturity loans have a single payment due at maturity,
                    // so the next due date IS the maturity date — never a
                    // monthly increment off the release date.
                    const isUponMaturity =
                      loanFrequency === "upon_maturity" ||
                      loan.interest_method === "upon_maturity" ||
                      loan.interest_type === "upon_maturity";
                    const nextDue = isUponMaturity
                      ? loan.maturity_date ?? loanSummary?.next_due_date ?? loan.next_due_date
                      : loanSummary?.next_due_date ?? loan.next_due_date;
                    return nextDue ? formatDate(nextDue) : "—";
                  })()}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Outstanding Balance</p>
                <p className="text-sm font-semibold">
                  {formatCurrency(
                    loanSummary?.outstanding_balance ?? loan.outstanding_balance ?? 0
                  )}
                </p>
              </div>
            </div>
            {loanSummary && (
              <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
                <div>
                  <p className="text-xs text-muted-foreground">Total Paid</p>
                  <p className="text-sm font-medium">{formatCurrency(loanSummary.total_paid ?? 0)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Principal Paid</p>
                  <p className="text-sm font-medium">{formatCurrency(loanSummary.principal_paid ?? 0)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Interest Paid</p>
                  <p className="text-sm font-medium">{formatCurrency(loanSummary.interest_paid ?? 0)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Overdue + Penalty</p>
                  <p className="text-sm font-semibold text-red-600">
                    {formatCurrency(
                      (loanSummary.overdue_amount ?? 0) + (loanSummary.penalty_amount ?? 0)
                    )}
                  </p>
                </div>
              </div>
            )}
        </CollapsibleCard>
      )}


      {/* Amortization Schedule — collapsible, collapsed by default. Shown for
          every loan that has a server schedule to read, rows or not: loading,
          failed and empty each say so in place of the rows. */}
      {scheduleSource !== null && (
        <Card>
          <CardHeader
            className="cursor-pointer select-none"
            onClick={() => setScheduleOpen((o) => !o)}
          >
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                Amortization Schedule
                {["draft", "for_review", "approved"].includes(loan.status) && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-yellow-700 dark:text-yellow-400 border-yellow-500/40 bg-yellow-500/10">
                    Preview
                  </Badge>
                )}
              </CardTitle>
              <div className="flex items-center gap-2">
                {(() => {
                  const isUponMaturity =
                    loan.frequency === "upon_maturity" ||
                    loan.interest_method === "upon_maturity" ||
                    loan.interest_type === "upon_maturity";
                  const canAutoPay =
                    isUponMaturity &&
                    ["released", "ongoing", "current", "past_due"].includes(loan.status) &&
                    (loanSummary?.outstanding_balance ?? loan.outstanding_balance ?? 0) > 0;
                  if (!canAutoPay) return null;
                  return (
                    <Button
                      size="sm"
                      className="h-7 px-2.5 text-xs bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark"
                      onClick={(e) => {
                        e.stopPropagation();
                        setAutoPayConfirmOpen(true);
                      }}
                    >
                      <Zap className="h-3.5 w-3.5 mr-1" />
                      Auto Pay
                    </Button>
                  );
                })()}
                {scheduleOpen ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </div>
          </CardHeader>
          {scheduleOpen && (
            <CardContent className="pt-0">
              {(() => {
                const isReleased = hasServerLoanData;
                const hasScb = storedScheduleTotals.shareCapitalBuildUp > 0;
                // In place of the rows on both tabs when there are none to draw.
                const scheduleNotice =
                  storedSchedule.length > 0 ? null : (
                    <ScheduleNotice load={scheduleLoad} loan={loan} onRetry={retrySchedule} />
                  );

                const scheduleTable = scheduleNotice ?? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12 text-center">#</TableHead>
                          <TableHead>Due Date</TableHead>
                          <TableHead className="text-right">Principal Due</TableHead>
                          <TableHead className="text-right">Interest</TableHead>
                          {hasScb && <TableHead className="text-right">Share Capital Build-Up</TableHead>}
                          <TableHead className="text-right">Total Payment</TableHead>
                          <TableHead className="text-right">Balance</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {storedSchedule.map((row) => (
                          <TableRow key={row.period}>
                            <TableCell className="text-center">{row.period}</TableCell>
                            <TableCell>{formatDateObj(row.dueDate)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(row.principal)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(row.interest)}</TableCell>
                            {hasScb && (
                              <TableCell className="text-right text-brand-orange">
                                {formatCurrency(row.shareCapitalBuildUp)}
                              </TableCell>
                            )}
                            <TableCell className="text-right font-medium">{formatCurrency(row.totalPayment)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(row.balance)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                      <TableFooter>
                        <TableRow>
                          <TableCell colSpan={2} className="font-semibold">Total</TableCell>
                          <TableCell className="text-right font-semibold">{formatCurrency(storedScheduleTotals.principal)}</TableCell>
                          <TableCell className="text-right font-semibold">{formatCurrency(storedScheduleTotals.interest)}</TableCell>
                          {hasScb && (
                            <TableCell className="text-right font-semibold text-brand-orange">
                              {formatCurrency(storedScheduleTotals.shareCapitalBuildUp)}
                            </TableCell>
                          )}
                          <TableCell className="text-right font-bold">{formatCurrency(storedScheduleTotals.totalPayment)}</TableCell>
                          <TableCell />
                        </TableRow>
                      </TableFooter>
                    </Table>
                  </div>
                );

                const balancesTable = (
                  <div className="space-y-3">
                    {loanSummary && (
                      <div className="flex flex-wrap gap-4 px-1">
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Current Outstanding</p>
                          <p className="text-base font-bold text-brand-orange tabular-nums">
                            {formatCurrency(loanSummary.outstanding_balance ?? 0)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Total Paid</p>
                          <p className="text-base font-bold tabular-nums">{formatCurrency(loanSummary.total_paid ?? 0)}</p>
                        </div>
                        {(loanSummary.overdue_amount ?? 0) > 0 && (
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Overdue</p>
                            <p className="text-base font-bold text-destructive tabular-nums">
                              {formatCurrency(loanSummary.overdue_amount ?? 0)}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                    <RestructuredBalanceFigures loan={loan} />
                    <AmortizationBalanceTable loan={loan} refreshKey={loanSummary} />
                  </div>
                );

                if (!isReleased) return scheduleTable;

                return (
                  <Tabs defaultValue="schedule" className="gap-3">
                    <TabsList>
                      <TabsTrigger value="schedule">Schedule</TabsTrigger>
                      <TabsTrigger value="balances">Amortization Balance</TabsTrigger>
                    </TabsList>
                    <TabsContent value="schedule">{scheduleTable}</TabsContent>
                    <TabsContent value="balances">{balancesTable}</TabsContent>
                  </Tabs>
                );
              })()}
            </CardContent>
          )}
        </Card>
      )}

      {/* Loan Documents — only for approved+ loans */}
      {loan.status !== "draft" && loan.status !== "for_review" && (
        <CollapsibleCard
          title="Generated Documents"
          icon={<FileText className="h-4 w-4 text-muted-foreground" />}
        >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                Open a document on your cooperative&apos;s letterhead, ready to
                print.
              </p>
              <PrintableMenu
                subjectId={loan.id}
                unavailable={printUnavailable}
                ids={[
                  "disclosure_statement",
                  "promissory_note",
                  "release_voucher",
                  "amortization_schedule",
                  "demand_letter",
                ]}
              />
            </div>
        </CollapsibleCard>
      )}

      {/* Attached documents — available for every loan, including drafts so
          the policy exception letter is reachable from the very first save. */}
      <LoanDocumentsCard loanId={loan.id} canUpload={canUpdateLoan} canDelete={canDeleteDocuments} />

      {/* Ledger — shown for every status that has server-side repayment data
          (incl. current / past_due), matching the Adjustments & History card. */}
      {hasServerLoanData && (
        <CollapsibleCard
          title="Ledger"
          icon={<BookOpen className="h-4 w-4 text-muted-foreground" />}
          contentClassName="p-0"
          headerExtra={
            <>
                {["released", "ongoing"].includes(loan.status) && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      // Start every adjustment from a clean form, however many
                      // have already been raised on this loan.
                      resetAdjustmentForm();
                      setCreateAdjustmentOpen(true);
                    }}
                  >
                    <Plus className="mr-1 h-3 w-3" />
                    New Adjustment
                  </Button>
                )}
                {["released", "ongoing", "current", "past_due"].includes(loan.status) && (
                  <Button
                    size="sm"
                    className="bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark"
                    onClick={() => setRecordPaymentOpen(true)}
                  >
                    <Plus className="mr-1 h-3 w-3" />
                    Record Payment
                  </Button>
                )}
            </>
          }
        >
            {repaymentsShortfall && !repaymentsLoading && (
              <IncompleteListNotice
                className="m-4"
                shown={repaymentsShortfall.shown}
                total={repaymentsShortfall.total}
                noun="payments"
                consequence="Payments missing from the ledger below are left out of its running principal, interest and SCB balances, so the balances it ends on are not the loan's current ones."
              />
            )}
            {repaymentsLoading || ledgerEntriesLoading ? (
              <div className="flex items-center justify-center py-8">
                <Spinner className="size-5 text-muted-foreground" />
              </div>
            ) : (
              (() => {
                const hasScb = (loan.scb_amount ?? 0) > 0;
                const dash = <span className="text-muted-foreground/40">—</span>;
                const fmtN = (n: number | undefined) =>
                  n != null && n > 0 ? formatCurrency(n) : dash;
                const totalCols = hasScb ? 14 : 13;
                return (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-xs">
                      <thead>
                        <tr className="border-b bg-muted/50 text-center font-semibold uppercase tracking-wide text-muted-foreground">
                          <th rowSpan={2} className="border-r px-3 py-2 text-left align-middle">Date</th>
                          <th rowSpan={2} className="border-r px-3 py-2 align-middle">Ref No</th>
                          <th colSpan={3} className="border-r border-b px-3 py-1">Principal</th>
                          <th colSpan={3} className="border-r border-b px-3 py-1">Interest</th>
                          <th colSpan={2} className="border-r border-b px-3 py-1">Past Due</th>
                          {hasScb && <th rowSpan={2} className="border-r px-3 py-2 align-middle">SCB</th>}
                          <th rowSpan={2} className="border-r px-3 py-2 align-middle">Others</th>
                          <th colSpan={2} className="border-b px-3 py-1">Total Paid</th>
                        </tr>
                        <tr className="border-b bg-muted/30 text-center text-muted-foreground">
                          <th className="border-r px-3 py-1">Debit</th>
                          <th className="border-r px-3 py-1">Credit</th>
                          <th className="border-r px-3 py-1">Balance</th>
                          <th className="border-r px-3 py-1">Debit</th>
                          <th className="border-r px-3 py-1">Credit</th>
                          <th className="border-r px-3 py-1">Balance</th>
                          <th className="border-r px-3 py-1">Penalty</th>
                          <th className="border-r px-3 py-1">Interest</th>
                          <th className="border-r px-3 py-1">Amount</th>
                          <th className="px-3 py-1 text-left">Remarks</th>
                        </tr>
                      </thead>
                      <tbody>
                        {/* Opening entry */}
                        {loanReleaseDate && (
                          <tr className="border-b bg-blue-50/40 dark:bg-blue-950/20">
                            <td className="border-r px-3 py-2 text-left">{formatDate(loanReleaseDate)}</td>
                            <td className="border-r px-3 py-2 text-center text-muted-foreground">—</td>
                            <td className="border-r px-3 py-2 text-right tabular-nums font-medium">{formatCurrency(loan.principal_amount)}</td>
                            <td className="border-r px-3 py-2 text-center">{dash}</td>
                            <td className="border-r px-3 py-2 text-right tabular-nums font-semibold">{formatCurrency(loan.principal_amount)}</td>
                            <td className="border-r px-3 py-2 text-right tabular-nums font-medium">{storedScheduleTotals.interest > 0 ? formatCurrency(storedScheduleTotals.interest) : dash}</td>
                            <td className="border-r px-3 py-2 text-center">{dash}</td>
                            <td className="border-r px-3 py-2 text-right tabular-nums font-semibold">{storedScheduleTotals.interest > 0 ? formatCurrency(storedScheduleTotals.interest) : dash}</td>
                            <td className="border-r px-3 py-2 text-center">{dash}</td>
                            <td className="border-r px-3 py-2 text-center">{dash}</td>
                            {hasScb && <td className="border-r px-3 py-2 text-center">{dash}</td>}
                            <td className="border-r px-3 py-2 text-center">{dash}</td>
                            <td className="border-r px-3 py-2 text-center text-muted-foreground">-</td>
                            <td className="px-3 py-2 italic text-muted-foreground">Loan released</td>
                          </tr>
                        )}
                        {/* Repayment + ledger entry rows, interleaved chronologically */}
                        {ledgerRows.length === 0 ? (
                          <tr>
                            <td colSpan={totalCols} className="px-3 py-6 text-center text-muted-foreground">
                              No repayments recorded yet.
                            </td>
                          </tr>
                        ) : (
                          ledgerRows.map((r) => {
                            const repaymentId = r.repaymentId;
                            return (
                              <tr
                                key={r.key}
                                className={cn(
                                  "border-b transition-colors hover:bg-muted/30",
                                  r.status === "voided" && "opacity-50 line-through",
                                )}
                              >
                                <td className="border-r px-3 py-2 text-left">{formatDate(r.date)}</td>
                                <td className="border-r px-3 py-2 text-center text-muted-foreground">{r.refNo}</td>
                                {/* Principal */}
                                <td className="border-r px-3 py-2 text-center">{dash}</td>
                                <td className="border-r px-3 py-2 text-right tabular-nums">{fmtN(r.principalPaid)}</td>
                                <td className="border-r px-3 py-2 text-right tabular-nums font-semibold">{formatCurrency(r.principalBal)}</td>
                                {/* Interest */}
                                <td className="border-r px-3 py-2 text-right tabular-nums">{fmtN(r.interestDebit)}</td>
                                <td className="border-r px-3 py-2 text-right tabular-nums">{fmtN(r.interestCredit)}</td>
                                <td className="border-r px-3 py-2 text-right tabular-nums font-semibold">{r.interestBal === null ? dash : formatCurrency(r.interestBal)}</td>
                                {/* Past Due */}
                                <td className="border-r px-3 py-2 text-right tabular-nums">
                                  {r.penaltyPaid != null && r.penaltyPaid > 0 ? (
                                    <span className="text-destructive">{formatCurrency(r.penaltyPaid)}</span>
                                  ) : dash}
                                </td>
                                <td className="border-r px-3 py-2 text-center">{dash}</td>
                                {/* SCB */}
                                {hasScb && <td className="border-r px-3 py-2 text-right tabular-nums">{fmtN(r.scbPaid)}</td>}
                                {/* Others */}
                                <td className="border-r px-3 py-2 text-right tabular-nums">{fmtN(r.excessAmount)}</td>
                                {/* Total Paid */}
                                <td className="border-r px-3 py-2 text-right tabular-nums font-semibold">{fmtN(r.totalPaid)}</td>
                                <td className="px-3 py-2">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-muted-foreground">{r.remarks}</span>
                                    {repaymentId != null && (
                                      <div className="flex shrink-0 items-center gap-1">
                                        {r.status === "voided" && (
                                          <Badge variant="destructive" className="text-[10px] px-1 py-0">voided</Badge>
                                        )}
                                        {r.status !== "voided" && (
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-5 px-1 text-[10px] text-destructive hover:text-destructive"
                                            onClick={() => handleVoidRepayment(repaymentId)}
                                            disabled={actionLoading}
                                          >
                                            Void
                                          </Button>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                );
              })()
            )}
        </CollapsibleCard>
      )}

      {/* Adjustments & Extension History — shown for every status that has
          server-side loan data (incl. current / past_due), matching the set
          fetchAdjustments loads for. */}
      {hasServerLoanData && (
        <CollapsibleCard
          title={<>Adjustments &amp; History</>}
          icon={<FileText className="h-4 w-4 text-muted-foreground" />}
          contentClassName="p-0"
        >
            {adjustmentsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Spinner className="size-5 text-muted-foreground" />
              </div>
            ) : adjustments.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                No adjustments recorded for this loan yet.
              </p>
            ) : (
              <div className="divide-y">
                {adjustments.map((adj) => (
                  <div key={adj.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {ADJUSTMENT_TYPE_LABELS[adj.adjustment_type] ?? adj.adjustment_type}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={cn("text-xs", adjustmentStatusColors[adj.status])}
                        >
                          {ADJUSTMENT_STATUS_LABELS[adj.status] ?? adj.status}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(adj.created_at)}
                        </span>
                      </div>
                      {(adj.description || adj.remarks) && (
                        <p
                          className="mt-1 text-sm text-muted-foreground truncate"
                          title={adj.description || adj.remarks}
                        >
                          {adj.description || adj.remarks}
                        </p>
                      )}
                    </div>
                    {adj.adjustment_type !== "extension" && adj.status === "pending" && (
                      <div className="flex shrink-0 items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={actionLoading}
                          onClick={() => handleAdjustmentAction(adj.id, "approve")}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive hover:text-destructive"
                          disabled={actionLoading}
                          onClick={() => handleAdjustmentAction(adj.id, "reject")}
                        >
                          Reject
                        </Button>
                      </div>
                    )}
                    {adj.adjustment_type !== "extension" && adj.status === "approved" && (
                      <div className="flex shrink-0 items-center gap-2">
                        <Button
                          size="sm"
                          className="bg-brand-blue text-brand-blue-foreground hover:bg-brand-blue-dark"
                          disabled={actionLoading}
                          onClick={() => handleAdjustmentAction(adj.id, "apply")}
                        >
                          Apply
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
        </CollapsibleCard>
      )}

      {/* ── Dialogs ── */}

      {/* Auto Pay Confirmation Dialog */}
      <Dialog open={autoPayConfirmOpen} onOpenChange={setAutoPayConfirmOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-brand-orange" />
              Confirm Auto Pay
            </DialogTitle>
            <DialogDescription>
              The full outstanding balance will be recorded as a payment for this upon-maturity loan.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center py-6">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Outstanding Balance</p>
            <p className="text-5xl font-bold text-brand-orange">
              {new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(
                Math.round(loanSummary?.outstanding_balance ?? loan?.outstanding_balance ?? 0)
              )}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              {loan?.borrower?.full_name ?? loan?.borrower?.name ?? "Member"}
            </p>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setAutoPayConfirmOpen(false)} disabled={autoPayProcessing}>
              Cancel
            </Button>
            <Button
              onClick={handleAutoPayConfirm}
              disabled={autoPayProcessing}
              className="bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark"
            >
              {autoPayProcessing ? (
                <>
                  <Spinner className="size-4 mr-2" />
                  Processing...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Confirm & Process
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Statement of Account Dialog */}
      <Dialog open={soaOpen} onOpenChange={setSoaOpen}>
        <DialogContent size="xl" className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Statement of Account</DialogTitle>
            <DialogDescription>
              Full transaction history and balance for{" "}
              <span className="font-medium">{loan.application_number}</span>.
            </DialogDescription>
          </DialogHeader>
          {soaLoading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner className="size-6 text-muted-foreground" />
            </div>
          ) : soaData ? (
            <div className="space-y-3 pt-2">
              <pre className="max-h-[60vh] overflow-auto rounded-md bg-muted/50 p-3 text-[11px] leading-relaxed font-mono">
                {JSON.stringify(soaData, null, 2)}
              </pre>
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No data available
            </p>
          )}
          <div className="flex justify-end pt-2">
            <Button variant="outline" onClick={() => setSoaOpen(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Release Dialog */}
      <Dialog open={releaseOpen} onOpenChange={setReleaseOpen}>
        <DialogContent size="xl" className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Release Loan</DialogTitle>
            <DialogDescription>
              Review the release details below before confirming. This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 pt-2">
            {/* Summary Grid */}
            <div className="rounded-lg border bg-muted/50 p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Application Number</p>
                  <p className="text-sm font-medium font-mono">{loan.application_number}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Member</p>
                  <p className="text-sm font-medium">{loanBorrowerName}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Loan Product</p>
                  <p className="text-sm font-medium">{loanProductName || "N/A"}</p>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Principal Amount</p>
                  <p className="text-sm font-semibold">{formatCurrency(loan.principal_amount)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Net Proceeds</p>
                  <p className="text-sm font-semibold text-green-600">
                    {releaseAmounts && !releaseAmounts.exceedsNetProceeds
                      ? formatCurrencyExact(releaseAmounts.netProceeds)
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Interest Rate / Type</p>
                  <p className="text-sm font-medium">
                    {formatRate(loan.interest_rate)}% / <span className="capitalize">{loanInterestType || "N/A"}</span>
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Term / Frequency</p>
                  <p className="text-sm font-medium">
                    {loanTermLabel} / {PAYMENT_FREQUENCY_LABELS[loanFrequency as keyof typeof PAYMENT_FREQUENCY_LABELS] ?? loanFrequency}
                  </p>
                </div>
              </div>
            </div>

            <ReleaseDeductions preview={releasePreview} onRetry={reloadReleasePreview} />

            <ReleaseCoMakers loan={loan} onLoanChange={setLoan} />

            {/* Dates the release will store: the loan's maturity and the
                server schedule's first instalment. */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Maturity Date</p>
                <p className="text-sm font-medium">
                  {loan.maturity_date ? formatDate(loan.maturity_date) : "N/A"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">First Due Date</p>
                <p className="text-sm font-medium">
                  {storedSchedule.length > 0 ? formatDateObj(storedSchedule[0].dueDate) : "N/A"}
                </p>
              </div>
            </div>

            <InsurancePremiumSection
              principalAmount={Number(loan.principal_amount) || 0}
              value={insurancePremium}
              onChange={setInsurancePremium}
              disabled={actionLoading}
            />

            {/* Amortization Preview: the server's preview rows */}
            <div className="space-y-2">
              <Label>Amortization Schedule Preview</Label>
              {storedSchedule.length === 0 ? (
                <ScheduleNotice load={scheduleLoad} loan={loan} onRetry={retrySchedule} />
              ) : (
                <div className="overflow-x-auto max-h-60 overflow-y-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10 text-center sticky top-0 bg-background">#</TableHead>
                        <TableHead className="sticky top-0 bg-background">Due Date</TableHead>
                        <TableHead className="text-right sticky top-0 bg-background">Principal</TableHead>
                        <TableHead className="text-right sticky top-0 bg-background">Interest</TableHead>
                        {scheduleTotals.shareCapitalBuildUp > 0 && (
                          <TableHead className="text-right sticky top-0 bg-background">SCB</TableHead>
                        )}
                        <TableHead className="text-right sticky top-0 bg-background">Total</TableHead>
                        <TableHead className="text-right sticky top-0 bg-background">Balance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {storedSchedule.map((row) => (
                        <TableRow key={row.period}>
                          <TableCell className="text-center text-xs">{row.period}</TableCell>
                          <TableCell className="text-xs">{formatDateObj(row.dueDate)}</TableCell>
                          <TableCell className="text-right text-xs">{formatCurrency(row.principal)}</TableCell>
                          <TableCell className="text-right text-xs">{formatCurrency(row.interest)}</TableCell>
                          {scheduleTotals.shareCapitalBuildUp > 0 && (
                            <TableCell className="text-right text-xs text-brand-orange">
                              {formatCurrency(row.shareCapitalBuildUp)}
                            </TableCell>
                          )}
                          <TableCell className="text-right text-xs font-medium">{formatCurrency(row.totalPayment)}</TableCell>
                          <TableCell className="text-right text-xs">{formatCurrency(row.balance)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <TableFooter>
                      <TableRow>
                        <TableCell colSpan={2} className="font-semibold text-xs">Total</TableCell>
                        <TableCell className="text-right font-semibold text-xs">{formatCurrency(scheduleTotals.principal)}</TableCell>
                        <TableCell className="text-right font-semibold text-xs">{formatCurrency(scheduleTotals.interest)}</TableCell>
                        {scheduleTotals.shareCapitalBuildUp > 0 && (
                          <TableCell className="text-right font-semibold text-xs text-brand-orange">
                            {formatCurrency(scheduleTotals.shareCapitalBuildUp)}
                          </TableCell>
                        )}
                        <TableCell className="text-right font-bold text-xs">{formatCurrency(scheduleTotals.totalPayment)}</TableCell>
                        <TableCell />
                      </TableRow>
                    </TableFooter>
                  </Table>
                </div>
              )}
            </div>

            {/* Warning */}
            {releaseAmounts?.exceedsNetProceeds ? (
              <div
                role="alert"
                className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 flex items-start gap-2"
              >
                <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                <p className="text-sm text-destructive">
                  Insurance collected exceeds the loan net proceeds. Lower the
                  premium, or collect part of it now and the rest later.
                </p>
              </div>
            ) : (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-sm text-amber-700">
                  Releasing this loan will lock the principal, interest rate, and term.
                  {releaseAmounts && (
                    <>
                      {" "}The borrower will receive{" "}
                      <span className="font-semibold">
                        {formatCurrencyExact(releaseAmounts.netProceeds)}
                      </span>{" "}
                      as net proceeds
                      {releaseAmounts.insuranceCollected > 0 && (
                        <>
                          {" "}(after {formatCurrencyExact(releaseAmounts.insuranceCollected)} insurance premium)
                        </>
                      )}
                      .
                    </>
                  )}
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setReleaseOpen(false);
                setInsurancePremium(INSURANCE_PREMIUM_INITIAL);
              }}
            >
              Cancel
            </Button>
            <Button
              className="bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark"
              onClick={handleRelease}
              disabled={!canConfirmRelease}
            >
              {actionLoading ? (
                <Spinner className="mr-2 size-4" />
              ) : (
                <Unlock className="mr-2 h-4 w-4" />
              )}
              {actionLoading ? "Releasing..." : "Confirm Release"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Record Payment Dialog */}
      <Dialog open={recordPaymentOpen} onOpenChange={setRecordPaymentOpen}>
        <DialogContent className="w-[95vw] sm:w-full sm:max-w-3xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2">
              <DollarSign className="h-5 w-5 shrink-0" />
              <span>Record Payment</span>
              {paymentMode === "advance" && (
                <Badge className="bg-blue-600 hover:bg-blue-600 text-white">
                  Advance Payment
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription className="break-words">
              {paymentMode === "advance"
                ? `Recording an advance payment for loan ${loan.loan_account_number || loan.application_number}. Excess will be applied to upcoming scheduled installments.`
                : `Record a repayment for loan ${loan.loan_account_number || loan.application_number}.`}
            </DialogDescription>
          </DialogHeader>

          {/* Loan / dues summary */}
          <div className="rounded-lg border bg-muted/30 p-3 sm:p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="font-semibold truncate">
                  {loan.borrower?.full_name ?? loan.borrower?.name ?? loan.borrower_name ?? "—"}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {loan.loan_account_number || loan.application_number} &middot;{" "}
                  {loan.loan_product?.name ?? loan.loan_product_name ?? "—"}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground uppercase">Outstanding</p>
                <p className="text-sm font-bold tabular-nums truncate">
                  {formatCurrency(
                    loanSummary?.outstanding_balance ?? loan.outstanding_balance ?? 0
                  )}
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground uppercase">Next Due</p>
                <p className="text-sm font-bold tabular-nums truncate">
                  {formatCurrency(loanSummary?.next_due_amount ?? 0)}
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground uppercase">Overdue</p>
                <p
                  className={cn(
                    "text-sm font-medium tabular-nums truncate",
                    (loanSummary?.overdue_amount ?? 0) > 0 && "text-destructive"
                  )}
                >
                  {formatCurrency(loanSummary?.overdue_amount ?? 0)}
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground uppercase">Penalty</p>
                <p
                  className={cn(
                    "text-sm font-medium tabular-nums truncate",
                    (loanSummary?.penalty_amount ?? 0) > 0 && "text-destructive"
                  )}
                >
                  {formatCurrency(loanSummary?.penalty_amount ?? 0)}
                </p>
              </div>
            </div>
          </div>

          {/* Current Scheduled Payment — shows the single amortization
              installment the borrower currently needs to pay (the earliest
              unpaid period). Gives the cashier a clear "this is what's due
              right now" anchor before they enter an amount. */}
          {storedSchedule.length > 0 && (() => {
            const current = storedSchedule.find((row) => row.status !== "paid");
            if (!current) return null;
            const hasScb = storedScheduleTotals.shareCapitalBuildUp > 0;
            const isOverdue = current.status === "overdue";
            const isPartial = current.status === "partial";
            // If the cashier has already typed an amount, surface what
            // portion of THIS payment lands on the current period.
            const currentAlloc = (paymentPreview?.allocations ?? []).find(
              (a) => a.period === current.period
            );
            const currentApplied =
              currentAlloc?.amount_applied ??
              (currentAlloc?.principal ?? 0) +
                (currentAlloc?.interest ?? 0) +
                (currentAlloc?.penalty ?? 0);
            const currentRemaining = currentAlloc?.remaining_balance ?? 0;
            const willFullySettle =
              !!currentAlloc && currentApplied > 0 && currentRemaining <= 0;
            return (
              <div className="rounded-lg border overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-muted/40 border-b">
                  <p className="text-xs font-medium flex items-center gap-1.5">
                    <CalendarIcon className="size-3.5 shrink-0" />
                    Current Scheduled Payment
                  </p>
                  {isOverdue ? (
                    <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
                      Overdue
                    </span>
                  ) : isPartial ? (
                    <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                      Partially Paid
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                      Pending
                    </span>
                  )}
                </div>
                <div className="px-3 sm:px-4 py-3 space-y-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                        Period {current.period} &middot; Due
                      </p>
                      <p className="text-base font-semibold truncate">
                        {formatDateObj(current.dueDate)}
                      </p>
                    </div>
                    {/* Prominent "Amount to Pay" callout — gives the cashier
                        an unmissable reference for what the borrower owes
                        for the current period, with a one-click fill into
                        the Amount input. */}
                    <div className="rounded-md border-2 border-emerald-300 bg-emerald-50 px-3 py-2 dark:border-emerald-700 dark:bg-emerald-950/30 sm:text-right">
                      <p className="text-[10px] text-emerald-800 dark:text-emerald-300 uppercase tracking-wide font-semibold">
                        Amount to Pay
                      </p>
                      <p className="text-2xl font-bold tabular-nums text-emerald-900 dark:text-emerald-200">
                        {formatCurrency(current.totalPayment)}
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          setPaymentAmount(current.totalPayment.toFixed(2))
                        }
                        className="mt-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400 underline-offset-2 hover:underline"
                      >
                        Use this amount →
                      </button>
                    </div>
                  </div>

                  <div className={cn("grid gap-2", hasScb ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2")}>
                    <div className="rounded-md border bg-background p-2 text-center min-w-0">
                      <p className="text-[10px] text-muted-foreground">Principal</p>
                      <p className="text-sm font-semibold tabular-nums truncate">
                        {formatCurrency(current.principal)}
                      </p>
                    </div>
                    <div className="rounded-md border bg-background p-2 text-center min-w-0">
                      <p className="text-[10px] text-muted-foreground">Interest</p>
                      <p className="text-sm font-semibold tabular-nums truncate">
                        {formatCurrency(current.interest)}
                      </p>
                    </div>
                    {hasScb && (
                      <div className="rounded-md border bg-background p-2 text-center min-w-0 col-span-2 sm:col-span-1">
                        <p className="text-[10px] text-muted-foreground">SCB</p>
                        <p className="text-sm font-semibold tabular-nums text-brand-orange truncate">
                          {formatCurrency(current.shareCapitalBuildUp)}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* When an amount is entered, show the live verdict for
                      the current period: settled / partial / no impact. */}
                  {currentAlloc && currentApplied > 0 && (
                    <div
                      className={cn(
                        "rounded-md border px-3 py-2 text-xs flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between",
                        willFullySettle
                          ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                          : "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-300"
                      )}
                    >
                      <span className="flex items-start gap-1.5 min-w-0">
                        <CheckCircle2 className="size-3.5 shrink-0 mt-0.5" />
                        <span className="break-words">
                          {willFullySettle
                            ? "This payment fully settles this scheduled period"
                            : `Partial: ${formatCurrency(currentRemaining)} will still be owed for this period`}
                        </span>
                      </span>
                      <span className="font-semibold tabular-nums whitespace-nowrap shrink-0">
                        applying {formatCurrency(currentApplied)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Payment mode toggle — declares the cashier's intent so it's
              auditable, and unlocks quick-fill helpers for paying ahead. */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-lg border bg-background p-3">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-xs font-medium">Payment Mode</p>
              <div className="inline-flex rounded-md border p-0.5 bg-muted/40">
                <button
                  type="button"
                  onClick={() => setPaymentMode("regular")}
                  className={cn(
                    "px-3 py-1 text-xs rounded-sm transition-colors",
                    paymentMode === "regular"
                      ? "bg-background shadow-sm font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Regular
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMode("advance")}
                  className={cn(
                    "px-3 py-1 text-xs rounded-sm transition-colors",
                    paymentMode === "advance"
                      ? "bg-background shadow-sm font-semibold text-blue-700 dark:text-blue-400"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Advance
                </button>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground sm:text-right break-words">
              {paymentMode === "regular"
                ? "Settles current dues — excess cascades automatically"
                : "Pay ahead toward upcoming scheduled installments"}
            </p>
          </div>

          {/* Advance-mode helpers: quick presets that auto-fill the amount
              with the sum of the next N unpaid scheduled installments. The
              cashier can still edit the amount manually. */}
          {paymentMode === "advance" && storedSchedule.length > 0 && (() => {
            const unpaid = storedSchedule.filter((r) => r.status !== "paid");
            if (unpaid.length === 0) return null;
            const sumOfNext = (n: number) =>
              unpaid.slice(0, n).reduce((s, r) => s + r.totalPayment, 0);
            const fillForPeriods = (n: number) => {
              const capped = Math.max(1, Math.min(n, unpaid.length));
              setAdvancePeriods(capped);
              const total = sumOfNext(capped);
              setPaymentAmount(total > 0 ? String(total.toFixed(2)) : "");
            };
            return (
              <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3 dark:border-blue-900 dark:bg-blue-950/20 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-blue-800 dark:text-blue-300">
                    Pay ahead by
                  </p>
                  <span className="text-[10px] text-muted-foreground">
                    {unpaid.length} unpaid period{unpaid.length === 1 ? "" : "s"} remaining
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[1, 2, 3, 6].filter((n) => n <= unpaid.length).map((n) => (
                    <Button
                      key={n}
                      type="button"
                      variant={advancePeriods === n ? "default" : "outline"}
                      size="sm"
                      className={cn(
                        "h-8 text-xs whitespace-nowrap",
                        advancePeriods === n &&
                          "bg-blue-600 hover:bg-blue-700 text-white"
                      )}
                      onClick={() => fillForPeriods(n)}
                    >
                      {n} period{n === 1 ? "" : "s"}
                      <span className="ml-1.5 opacity-80 text-[10px] tabular-nums">
                        ({formatCurrency(sumOfNext(n))})
                      </span>
                    </Button>
                  ))}
                  <Button
                    type="button"
                    variant={advancePeriods === unpaid.length ? "default" : "outline"}
                    size="sm"
                    className={cn(
                      "h-8 text-xs whitespace-nowrap",
                      advancePeriods === unpaid.length &&
                        "bg-blue-600 hover:bg-blue-700 text-white"
                    )}
                    onClick={() => fillForPeriods(unpaid.length)}
                  >
                    Pay all remaining
                    <span className="ml-1.5 opacity-80 text-[10px] tabular-nums">
                      ({formatCurrency(sumOfNext(unpaid.length))})
                    </span>
                  </Button>
                </div>
                <p className="text-[11px] text-blue-800/80 dark:text-blue-300/80 break-words">
                  Tap a preset to auto-fill the amount. You can still edit it
                  manually below — the allocation preview will recompute.
                </p>
              </div>
            );
          })()}

          {/* Form */}
          <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 pt-2">
            <div className="space-y-1.5 min-w-0">
              <Label>Payment Date <span className="text-red-500">*</span></Label>
              <Popover open={paymentDatePickerOpen} onOpenChange={setPaymentDatePickerOpen}>
                <PopoverTrigger
                  render={
                    <button
                      type="button"
                      className="flex h-9 w-full items-center gap-2 rounded-lg border border-input bg-transparent px-3 text-sm transition-colors hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                    />
                  }
                >
                  <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                  <span>{formatDateObj(paymentDate)}</span>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={paymentDate}
                    onSelect={(date) => {
                      if (date) setPaymentDate(date);
                      setPaymentDatePickerOpen(false);
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1.5 min-w-0">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <Label htmlFor="payment-amount">
                  Amount <span className="text-red-500">*</span>
                </Label>
                {(() => {
                  const currentDue = storedSchedule.find((r) => r.status !== "paid");
                  if (!currentDue) return null;
                  const suggested = currentDue.totalPayment;
                  if (suggested <= 0) return null;
                  return (
                    <button
                      type="button"
                      onClick={() => setPaymentAmount(suggested.toFixed(2))}
                      className="text-[10px] font-medium text-brand-orange hover:underline tabular-nums"
                    >
                      Use {formatCurrency(suggested)}
                    </button>
                  );
                })()}
              </div>
              <Input
                id="payment-amount"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                className="w-full"
              />
              {paymentAmount && Number(paymentAmount) > 0 && (
                <p className="text-[11px] text-muted-foreground tabular-nums">
                  Borrower will pay{" "}
                  <span className="font-semibold text-foreground">
                    {formatCurrency(Number(paymentAmount))}
                  </span>
                </p>
              )}
            </div>
            <div className="space-y-1.5 sm:col-span-2 min-w-0">
              <Label htmlFor="payment-remarks">Remarks (optional)</Label>
              <Textarea
                id="payment-remarks"
                placeholder="Add notes about this payment..."
                value={paymentRemarks}
                onChange={(e) => setPaymentRemarks(e.target.value)}
                rows={2}
              />
            </div>
          </div>

          {/* Payment Application Order — explains the fixed hierarchy the
              backend uses when distributing the entered amount. Cashiers
              and auditors need to see *why* the breakdown lands where it
              does. The order matches the repayment engine on the server. */}
          {(() => {
            const loanHasScb = (loan?.scb_amount ?? 0) > 0;
            const steps: Array<{
              n: number;
              label: string;
              hint: string;
              cls: string;
            }> = [
              {
                n: 1,
                label: "Penalty",
                hint: "Late-payment fees first",
                cls: "border-destructive/40 bg-destructive/5 text-destructive",
              },
              {
                n: 2,
                label: "Overdue Interest",
                hint: "Interest on missed periods",
                cls: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-300",
              },
              {
                n: 3,
                label: "Current Interest",
                hint: "Interest for the current period",
                cls: "border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-700 dark:bg-blue-950/30 dark:text-blue-300",
              },
              {
                n: 4,
                label: "Current Principal",
                hint: "Principal for the current period",
                cls: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300",
              },
              loanHasScb
                ? {
                    n: 5,
                    label: "SCB (Excess)",
                    hint: "Share Capital Build-Up credit",
                    cls: "border-orange-300 bg-orange-50 text-orange-800 dark:border-orange-700 dark:bg-orange-950/30 dark:text-orange-300",
                  }
                : {
                    n: 5,
                    label: "Next Interest",
                    hint: "Advance toward next period",
                    cls: "border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-700 dark:bg-blue-950/30 dark:text-blue-300",
                  },
              {
                n: 6,
                label: loanHasScb ? "Next Interest" : "Next Principal",
                hint: loanHasScb
                  ? "If SCB is settled, future periods next"
                  : "Advance principal reduction",
                cls: "border-muted-foreground/30 bg-muted/40 text-foreground",
              },
            ];
            return (
              <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
                <div className="flex items-center gap-1.5">
                  <CreditCard className="size-3.5 text-muted-foreground" />
                  <p className="text-xs font-semibold">Payment Application Order</p>
                  <span className="text-[10px] text-muted-foreground">
                    how each ₱ paid is distributed
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {steps.map((s, i) => (
                    <div key={s.n} className="flex items-center gap-1.5">
                      <div
                        className={cn(
                          "rounded-md border px-2 py-1 text-[10px] font-medium flex items-center gap-1.5",
                          s.cls
                        )}
                      >
                        <span className="inline-flex items-center justify-center rounded-full bg-background/80 size-4 text-[9px] font-bold">
                          {s.n}
                        </span>
                        <span className="whitespace-nowrap">{s.label}</span>
                      </div>
                      {i < steps.length - 1 && (
                        <span className="text-[10px] text-muted-foreground">→</span>
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  The system applies the entered amount in this order. Each
                  bucket must be fully covered before excess flows to the
                  next. {loanHasScb
                    ? "Because this loan has SCB, leftover after current dues credits the borrower's Share Capital before advancing future periods."
                    : "This loan has no SCB, so leftover after current dues advances directly to upcoming periods."}
                </p>
              </div>
            );
          })()}

          {/* Allocation Preview */}
          {paymentPreview && Number(paymentAmount) > 0 && (
            <>
              <Separator />
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium flex flex-wrap items-center gap-2">
                    <CreditCard className="size-4 shrink-0" />
                    <span>Payment Allocation</span>
                    {paymentPreviewLoading && (
                      <span className="text-[10px] font-normal text-muted-foreground">checking…</span>
                    )}
                    {!paymentPreviewLoading && (
                      <Badge variant="outline" className="text-[10px] font-normal">
                        Server-verified
                      </Badge>
                    )}
                  </p>
                </div>

                {/* Component allocation totals */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="rounded-lg border p-2 sm:p-3 text-center min-w-0">
                    <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wide">Penalty</p>
                    <p
                      className={cn(
                        "text-sm font-semibold tabular-nums truncate",
                        (paymentPreview.total_penalty ?? 0) > 0 && "text-destructive"
                      )}
                    >
                      {formatCurrency(paymentPreview.total_penalty ?? 0)}
                    </p>
                  </div>
                  <div className="rounded-lg border p-2 sm:p-3 text-center min-w-0">
                    <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wide">Interest</p>
                    <p className="text-sm font-semibold tabular-nums truncate">
                      {formatCurrency(paymentPreview.total_interest ?? 0)}
                    </p>
                  </div>
                  <div className="rounded-lg border p-2 sm:p-3 text-center min-w-0">
                    <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wide">Principal</p>
                    <p className="text-sm font-semibold tabular-nums truncate">
                      {formatCurrency(paymentPreview.total_principal ?? 0)}
                    </p>
                  </div>
                  <div
                    className={cn(
                      "rounded-lg border p-2 sm:p-3 text-center min-w-0",
                      (paymentPreview.excess ?? 0) > 0 &&
                        "border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20"
                    )}
                  >
                    <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wide">Excess / SCB</p>
                    <p
                      className={cn(
                        "text-sm font-semibold tabular-nums truncate",
                        (paymentPreview.excess ?? 0) > 0 && "text-amber-700 dark:text-amber-400"
                      )}
                    >
                      {formatCurrency(paymentPreview.excess ?? 0)}
                    </p>
                  </div>
                </div>

                {/* Per-schedule allocation table */}
                {Array.isArray(paymentPreview.allocations) && paymentPreview.allocations.length > 0 && (() => {
                  const loanHasScb = (loan?.scb_amount ?? 0) > 0;
                  // A dash with no schedule on screen to read the build-up from.
                  const periodScb = (period: number | undefined) => {
                    if (storedSchedule.length === 0) return "—";
                    if (typeof period !== "number") return formatCurrency(0);
                    const row = storedSchedule.find((r) => r.period === period);
                    return formatCurrency(row?.shareCapitalBuildUp ?? 0);
                  };
                  return (
                  <div className="rounded-lg border overflow-hidden">
                    <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-muted/40 border-b">
                      <p className="text-xs font-medium flex items-center gap-1.5">
                        <Receipt className="size-3.5 shrink-0" />
                        Schedule Periods Covered
                      </p>
                      <span className="text-[10px] text-muted-foreground">
                        {paymentPreview.allocations.length} period
                        {paymentPreview.allocations.length === 1 ? "" : "s"}
                      </span>
                    </div>
                    <div className="overflow-x-auto -mx-px">
                      <Table className={cn("min-w-[640px]", loanHasScb && "min-w-[720px]")}>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-12 text-center text-[10px] uppercase">#</TableHead>
                            <TableHead className="text-[10px] uppercase">Due Date</TableHead>
                            <TableHead className="text-right text-[10px] uppercase">Principal</TableHead>
                            <TableHead className="text-right text-[10px] uppercase">Interest</TableHead>
                            {loanHasScb && (
                              <TableHead className="text-right text-[10px] uppercase">SCB</TableHead>
                            )}
                            <TableHead className="text-right text-[10px] uppercase">Penalty</TableHead>
                            <TableHead className="text-right text-[10px] uppercase">Applied</TableHead>
                            <TableHead className="text-right text-[10px] uppercase">Remaining</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paymentPreview.allocations.map((a, idx) => {
                            const applied =
                              a.amount_applied ??
                              (a.principal ?? 0) + (a.interest ?? 0) + (a.penalty ?? 0);
                            const remaining = a.remaining_balance ?? 0;
                            const isFullySettled = remaining <= 0 && applied > 0;
                            return (
                              <TableRow key={`${a.schedule_id ?? idx}-${a.period ?? idx}`}>
                                <TableCell className="text-center text-xs font-medium">
                                  {a.period ?? idx + 1}
                                </TableCell>
                                <TableCell className="text-xs">
                                  {a.due_date ? formatDate(a.due_date) : "—"}
                                </TableCell>
                                <TableCell className="text-right text-xs tabular-nums">
                                  {formatCurrency(a.principal ?? 0)}
                                </TableCell>
                                <TableCell className="text-right text-xs tabular-nums">
                                  {formatCurrency(a.interest ?? 0)}
                                </TableCell>
                                {loanHasScb && (
                                  <TableCell className="text-right text-xs tabular-nums text-brand-orange">
                                    {periodScb(a.period)}
                                  </TableCell>
                                )}
                                <TableCell
                                  className={cn(
                                    "text-right text-xs tabular-nums",
                                    (a.penalty ?? 0) > 0 && "text-destructive"
                                  )}
                                >
                                  {formatCurrency(a.penalty ?? 0)}
                                </TableCell>
                                <TableCell className="text-right text-xs font-semibold tabular-nums">
                                  {formatCurrency(applied)}
                                </TableCell>
                                <TableCell className="text-right text-xs tabular-nums">
                                  {isFullySettled ? (
                                    <span className="inline-flex items-center rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                                      Settled
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground">
                                      {formatCurrency(remaining)}
                                    </span>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                    {!loanHasScb && (
                      <div className="px-3 py-2 bg-muted/20 border-t text-[11px] text-muted-foreground">
                        This loan has no Share Capital Build-Up configured, so
                        the SCB column is hidden. Loans with SCB will show a
                        per-period SCB column here.
                      </div>
                    )}
                  </div>
                  );
                })()}

                {/* Outcome summary */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border bg-background p-3 min-w-0">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">
                      New Outstanding Balance
                    </p>
                    <p className="text-lg font-bold tabular-nums break-words">
                      {formatCurrency(
                        Math.max(
                          0,
                          (loanSummary?.outstanding_balance ?? loan.outstanding_balance ?? 0) -
                            (paymentPreview.total_principal ?? 0)
                        )
                      )}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                      was{" "}
                      {formatCurrency(
                        loanSummary?.outstanding_balance ?? loan.outstanding_balance ?? 0
                      )}
                    </p>
                  </div>

                  {(paymentPreview.excess ?? 0) > 0 && (
                    <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-900/20 min-w-0">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">
                        Excess → Share Capital / Future Periods
                      </p>
                      <p className="text-lg font-bold text-amber-700 dark:text-amber-400 tabular-nums break-words">
                        {formatCurrency(paymentPreview.excess ?? 0)}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 break-words">
                        will be applied per allocation rules
                      </p>
                    </div>
                  )}
                </div>

                {/* Reconciliation footer */}
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-dashed bg-muted/30 px-3 py-2 text-xs">
                  <span className="text-muted-foreground">Total Recorded</span>
                  <span className="font-bold tabular-nums">
                    {formatCurrency(Number(paymentAmount) || 0)}
                  </span>
                </div>
              </div>
            </>
          )}

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-4 sticky bottom-0 bg-background -mx-4 px-4 sm:-mx-6 sm:px-6 pb-1">
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => setRecordPaymentOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="w-full sm:w-auto bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark"
              onClick={handleRecordPayment}
              disabled={actionLoading || !paymentAmount || Number(paymentAmount) <= 0}
            >
              {actionLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Posting...
                </>
              ) : (
                <>
                  <DollarSign className="mr-2 h-4 w-4" />
                  Record Payment
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Extend Loan Dialog (Upon Maturity — Process 1: manual extension) */}
      <AlertDialog
        open={extendOpen}
        onOpenChange={(open) => {
          setExtendOpen(open);
          // Always reopen on the safer default rather than remembering a
          // previous "defer".
          if (open) setExtendInterestOption("pay");
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <CalendarPlus className="h-5 w-5 text-muted-foreground" />
              Extend Loan
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will move the loan&apos;s due date forward by one cycle.
              The principal and any remaining balance are unchanged.{" "}
              {extendInterestOption === "pay"
                ? "The interest due below will be collected as a payment before the loan extends."
                : "The interest due below stays unpaid and is added to the new period's interest."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="rounded-md border-2 border-emerald-300 bg-emerald-50 px-3 py-2 dark:border-emerald-700 dark:bg-emerald-950/30">
            <p className="text-[10px] text-emerald-800 dark:text-emerald-300 uppercase tracking-wide font-semibold">
              {extendInterestOption === "pay"
                ? "Interest Due — will be collected to extend"
                : "Interest Due — carried into the new period"}
            </p>
            <p className="text-2xl font-bold tabular-nums text-emerald-900 dark:text-emerald-200">
              {currentInterestDue === null ? "—" : formatCurrencyPrecise(currentInterestDue)}
            </p>
            {extendInterestOption === "defer" && extendDeferredInterestTotal !== null && (
              // Spells out the stacking the team described: ₱50 already due
              // plus ₱50 fresh becomes ₱100 owed on the new period.
              <p className="mt-1 text-xs text-emerald-800 dark:text-emerald-300">
                Stays unpaid — the new period will owe{" "}
                <span className="font-semibold tabular-nums">
                  {formatCurrencyPrecise(extendDeferredInterestTotal)}
                </span>{" "}
                once this cycle&apos;s interest is added.
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Interest Due Option</Label>
            <Select
              value={extendInterestOption}
              onValueChange={(v) => setExtendInterestOption(v as "pay" | "defer")}
            >
              <SelectTrigger className="w-full">
                {/* Render function, else the trigger shows the raw value */}
                <SelectValue>
                  {(value: string | null) =>
                    value === "defer" ? "Defer Outstanding Interest" : "Pay Outstanding Interest"
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pay">
                  <span className="font-medium">Pay Outstanding Interest</span>
                  <span className="block text-xs text-muted-foreground">
                    Pay the accrued interest before extension
                  </span>
                </SelectItem>
                <SelectItem value="defer">
                  <span className="font-medium">Defer Outstanding Interest</span>
                  <span className="block text-xs text-muted-foreground">
                    Outstanding interest remains unpaid and is added to the total interest due
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Extension Details</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={1}
                disabled
                className="w-20"
                aria-label="Extension duration"
              />
              <Select value="months" disabled>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Months" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="days">Days</SelectItem>
                  <SelectItem value="months">Months</SelectItem>
                  <SelectItem value="years">Years</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">
              Every extension moves the due date forward by one fixed cycle.
            </p>
            <div className="rounded-md border bg-muted/30 px-3 py-2">
              <p className="text-xs text-muted-foreground">New Maturity Date</p>
              <p className="text-sm font-medium">
                {extendPreviewMaturityDate ? formatDate(extendPreviewMaturityDate) : "—"}
              </p>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="extend-remarks" className="text-xs">
              Remarks (optional)
            </Label>
            <Textarea
              id="extend-remarks"
              value={extendRemarks}
              onChange={(e) => setExtendRemarks(e.target.value)}
              placeholder="e.g. borrower requested extension"
              rows={2}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleExtendLoan}
              disabled={actionLoading}
              className="bg-brand-blue text-brand-blue-foreground shadow-sm hover:bg-brand-blue-dark hover:shadow-md transition-all"
            >
              {actionLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Extending...
                </>
              ) : (
                <>
                  <CalendarPlus className="mr-2 h-4 w-4" />
                  Confirm Extension
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Partial-Payment Extend Prompt (Upon Maturity — Process 2) */}
      <AlertDialog open={partialExtendOpen} onOpenChange={setPartialExtendOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Extend loan?</AlertDialogTitle>
            <AlertDialogDescription>
              Payment is not enough to fully settle this loan. Do you want to
              extend the loan? The remaining principal and interest will be
              carried over to the next cycle.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={actionLoading}
              onClick={handlePartialExtendDecline}
            >
              No, thanks
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={actionLoading}
              onClick={handlePartialExtendConfirm}
              className="bg-brand-blue text-brand-blue-foreground shadow-sm hover:bg-brand-blue-dark hover:shadow-md transition-all"
            >
              {actionLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Extending...
                </>
              ) : (
                <>
                  <CalendarPlus className="mr-2 h-4 w-4" />
                  Yes, extend
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create Adjustment Dialog */}
      <Dialog open={createAdjustmentOpen} onOpenChange={setCreateAdjustmentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Loan Adjustment</DialogTitle>
            <DialogDescription>
              Submit an adjustment request for loan {loan.loan_account_number || loan.application_number}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Adjustment Type <span className="text-red-500">*</span></Label>
              <Select
                value={adjType}
                onValueChange={(v) => {
                  setAdjType(v as LoanAdjustmentType);
                  // Each type collects different figures — don't carry the
                  // previous type's numbers over.
                  resetAdjustmentValueFields();
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select adjustment type">
                    {(value: string | null) =>
                      value
                        ? (ADJUSTMENT_TYPE_LABELS[value] ?? value)
                        : "Select adjustment type"
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="penalty_waiver">Penalty Waiver</SelectItem>
                  <SelectItem value="balance_adjustment">Balance Adjustment</SelectItem>
                  <SelectItem value="term_extension">Term Extension</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="adj-description">Description</Label>
              <Input
                id="adj-description"
                placeholder="Brief description of the adjustment"
                value={adjDescription}
                onChange={(e) => setAdjDescription(e.target.value)}
              />
            </div>
            {/* Dynamic fields based on adjustment type */}
            {adjType === "balance_adjustment" && (
              <div className="space-y-1.5">
                <Label htmlFor="adj-new-balance">New Outstanding Balance <span className="text-red-500">*</span></Label>
                <Input
                  id="adj-new-balance"
                  type="number"
                  placeholder="0.00"
                  step="0.01"
                  value={adjNewBalance}
                  onChange={(e) => setAdjNewBalance(e.target.value)}
                />
              </div>
            )}
            {adjType === "penalty_waiver" && (
              // The API waives a schedule's penalty in full — there is no
              // partial-amount waiver — so this states what will happen rather
              // than asking for a figure it would have to ignore.
              <div className="space-y-1.5">
                <Label>Penalties to Waive</Label>
                <div className="rounded-md border border-border bg-muted/40 px-3 py-2.5 text-sm">
                  <p className="font-medium">
                    All outstanding penalties on this loan will be waived.
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Penalties are waived in full per schedule; a partial amount cannot be waived.
                    This still requires approval before it is applied.
                  </p>
                </div>
              </div>
            )}
            {adjType === "term_extension" && (
              <div className="space-y-1.5">
                <Label htmlFor="adj-extend-term">
                  {extendsByMonth ? "Additional Months" : "Additional Instalments"} <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="adj-extend-term"
                  type="number"
                  min="1"
                  placeholder="e.g. 3"
                  value={adjAdditionalMonths}
                  onChange={(e) => setAdjAdditionalMonths(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Current term is {loanTerm ?? "—"} {loanTermUnitWord}
                  {adjAdditionalMonths && Number(adjAdditionalMonths) > 0
                    ? extendsByMonth
                      ? ` — this extends it to ${(loanTerm ?? 0) + Number(adjAdditionalMonths)} months.`
                      : ` — this adds ${Number(adjAdditionalMonths)} instalment(s).`
                    : "."}
                </p>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="adj-remarks">Remarks</Label>
              <Textarea
                id="adj-remarks"
                placeholder="Additional notes..."
                value={adjRemarks}
                onChange={(e) => setAdjRemarks(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setCreateAdjustmentOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark"
              onClick={handleCreateAdjustment}
              disabled={actionLoading}
            >
              <Plus className="mr-2 h-4 w-4" />
              Submit Adjustment
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Auto-Pay Dialog */}
      {loan && (
        <AutoPayToggleDialog
          loanId={loan.id}
          loanAccountNumber={loan.loan_account_number}
          currentEnabled={loan.auto_pay_enabled ?? false}
          currentCbsReference={loan.auto_pay_cbs_reference}
          open={autoPayDialogOpen}
          onOpenChange={(open) => {
            setAutoPayDialogOpen(open);
            if (!open) setAutoPayIsPostRelease(false);
          }}
          isPostRelease={autoPayIsPostRelease}
          onSuccess={(settings) => {
            setLoan((prev) =>
              prev
                ? {
                    ...prev,
                    auto_pay_enabled: settings.auto_pay_enabled,
                    auto_pay_cbs_reference: settings.cbs_reference,
                  }
                : prev
            );
            setAutoPayIsPostRelease(false);
          }}
        />
      )}
    </div>
  );
}
