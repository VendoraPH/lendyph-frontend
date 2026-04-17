"use client";

import { useState, useMemo, useEffect, useCallback, use } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";
import {
  loanService,
  loanAdjustmentService,
  loanDocumentService,
  repaymentService,
  coMakerService,
  userService,
  approvalWorkflowService,
  reportService,
  type ApprovalChainStep,
} from "@/services";
import { useAuthStore } from "@/store/auth-store";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { generateDisclosureHTML, generatePromissoryNoteHTML } from "@/lib/loan-document-templates";
import { LoanDocumentsCard } from "./_components/loan-documents-card";
import type { LoanSchedule } from "@/types/loan";
import type { LoanAdjustment, LoanAdjustmentType, Repayment, User } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Check,
  X,
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
  Download,
  Plus,
  DollarSign,
  Settings2,
  ChevronsUpDown,
  ChevronDown,
  ChevronUp,
  Pencil,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  LOAN_STATUS_LABELS,
  PAYMENT_FREQUENCY_LABELS,
  PAYMENT_FREQUENCY_OPTIONS,
} from "@/constants";
import type { Loan, LoanStatus } from "@/types/loan";

// ── Currency & Date Formatters ──

const formatCurrency = (amount: number | string | undefined | null) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(parseFloat(String(amount ?? 0)) || 0));

const formatDate = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

const formatDateTime = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const formatDateObj = (date: Date) =>
  date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

const formatDateISO = (date: Date) => date.toISOString().split("T")[0];

// ── Amortization Schedule Helpers ──

type PaymentFrequency = "daily" | "weekly" | "bi_weekly" | "monthly";
type InterestType = "fixed" | "diminishing" | "upon_maturity";

interface AmortizationRow {
  period: number;
  dueDate: Date;
  principal: number;
  interest: number;
  shareCapitalBuildUp: number;
  totalPayment: number;
  balance: number;
}

function getPeriodsFromMonths(termMonths: number, frequency: PaymentFrequency): number {
  switch (frequency) {
    case "daily":
      return Math.round(termMonths * 30);
    case "weekly":
      return Math.round(termMonths * 4.33);
    case "bi_weekly":
      return Math.round(termMonths * 2.17);
    case "monthly":
      return termMonths;
  }
}

function getIntervalDays(frequency: PaymentFrequency): number {
  switch (frequency) {
    case "daily":
      return 1;
    case "weekly":
      return 7;
    case "bi_weekly":
      return 14;
    case "monthly":
      return 30;
  }
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function generateSchedule(
  principal: number,
  rate: number,
  termMonths: number,
  frequency: PaymentFrequency,
  interestType: InterestType,
  startDate: Date,
  scbAmount: number = 0,
): AmortizationRow[] {
  // Upon Maturity = a single consolidated payment at the maturity date.
  // Full principal + total interest for the whole term, regardless of
  // term length or frequency.
  if (interestType === "upon_maturity") {
    const totalInterest = principal * (rate / 100) * termMonths;
    const totalScb = scbAmount * getPeriodsFromMonths(termMonths, frequency);
    return [{
      period: 1,
      dueDate: addMonths(startDate, termMonths),
      principal,
      interest: totalInterest,
      shareCapitalBuildUp: totalScb,
      totalPayment: principal + totalInterest + totalScb,
      balance: 0,
    }];
  }

  const totalPeriods = getPeriodsFromMonths(termMonths, frequency);
  const intervalDays = getIntervalDays(frequency);
  const principalPerPeriod = principal / totalPeriods;
  const rows: AmortizationRow[] = [];

  let remainingBalance = principal;

  for (let i = 1; i <= totalPeriods; i++) {
    const dueDate =
      frequency === "monthly"
        ? addMonths(startDate, i)
        : addDays(startDate, i * intervalDays);

    let interest: number;
    if (interestType === "fixed") {
      interest = principal * (rate / 100);
    } else {
      interest = remainingBalance * (rate / 100);
    }

    remainingBalance -= principalPerPeriod;

    rows.push({
      period: i,
      dueDate,
      principal: principalPerPeriod,
      interest,
      shareCapitalBuildUp: scbAmount,
      totalPayment: principalPerPeriod + interest + scbAmount,
      balance: Math.max(0, remainingBalance),
    });
  }

  return rows;
}

// ── Status Colors ──

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-500/15 dark:text-gray-400 dark:border-gray-700",
  for_review: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-800",
  approved: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-800",
  rejected: "bg-red-100 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-800",
  released: "bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-500/15 dark:text-cyan-400 dark:border-cyan-800",
  ongoing: "bg-green-100 text-green-700 border-green-200 dark:bg-green-500/15 dark:text-green-400 dark:border-green-800",
  completed: "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-500/15 dark:text-gray-400 dark:border-gray-700",
  defaulted: "bg-red-100 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-800",
  restructured: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-500/15 dark:text-orange-400 dark:border-orange-800",
  closed: "bg-gray-200 text-gray-500 border-gray-300 dark:bg-gray-500/15 dark:text-gray-400 dark:border-gray-700",
};

// ── Multi-Step Approval Chain ──
// Implements the LOAN RELEASE FLOWCHART. The chain is loaded from
// approvalWorkflowService so admins can reconfigure it via
// /settings/approval-workflow. Each loan snapshots the chain at seed time,
// so changes to the config only affect NEW loans (in-flight loans keep
// whatever chain they started with).
//
// On any "Approved? = No" the loan is sent back to Loan Processor for
// revision (the chain does NOT support terminal rejection — "Void Loan"
// is the escape hatch for drafts).

type ChainStepKind = "submit" | "approve" | "release";

type ApprovalStepStatus = "waiting" | "pending" | "approved" | "sent_back";

interface ApprovalStep {
  index: number;
  name: string;
  role: string;
  kind: ChainStepKind;
  status: ApprovalStepStatus;
  remarks?: string;
  acted_at?: string; // ISO
  acted_by?: string;
}

// A snapshot of a previous revision round, created whenever an approver sends
// the loan back to the Loan Processor.
interface RevisionRound {
  round: number;
  steps: ApprovalStep[];
  sent_back_by: string;
  sent_back_at: string;
  sent_back_remarks: string;
}

interface ApprovalState {
  current_steps: ApprovalStep[];
  rounds: RevisionRound[];
}

function buildFreshSteps(
  chain: ApprovalChainStep[],
  pendingIndex: number = 0
): ApprovalStep[] {
  return chain.map((step, i) => ({
    index: i,
    name: step.name,
    role: step.role,
    kind: step.kind,
    status: i === pendingIndex ? "pending" : "waiting",
  }));
}

function canUserActOnStep(step: ApprovalStep, userRoles: string[] | undefined): boolean {
  if (!userRoles || userRoles.length === 0) return false;
  // Admins can act on any step (useful for testing and for super-users)
  if (userRoles.includes("admin")) return true;
  return userRoles.includes(step.role);
}

function approvalStorageKey(loanId: number | string): string {
  return `loan-approval-${loanId}`;
}

// Back-compat migration: older stored approval states were saved before
// the `kind` field existed on ApprovalStep. Without a kind, the action
// panel's conditional buttons (`kind === "approve"`) silently render
// nothing. Infer the kind from the step name so old loans still work.
function migrateStep(step: ApprovalStep): ApprovalStep {
  if (step.kind) return step;
  const name = (step.name ?? "").toLowerCase();
  const inferred: ChainStepKind = name.includes("loan processor") || name.includes("processor")
    ? "submit"
    : name.includes("cashier") || name.includes("release")
      ? "release"
      : "approve";
  return { ...step, kind: inferred };
}

function migrateSteps(steps: ApprovalStep[]): ApprovalStep[] {
  return steps.map(migrateStep);
}

function loadApprovalState(loanId: number | string): ApprovalState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(approvalStorageKey(loanId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ApprovalState | ApprovalStep[];
    // Back-compat: earlier version stored a bare array
    if (Array.isArray(parsed)) {
      return { current_steps: migrateSteps(parsed), rounds: [] };
    }
    if (!parsed.current_steps || !Array.isArray(parsed.current_steps)) return null;
    return {
      current_steps: migrateSteps(parsed.current_steps),
      rounds: (parsed.rounds ?? []).map((r) => ({
        ...r,
        steps: migrateSteps(r.steps),
      })),
    };
  } catch {
    return null;
  }
}

function saveApprovalState(loanId: number | string, state: ApprovalState) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(approvalStorageKey(loanId), JSON.stringify(state));
  } catch {
    /* ignore quota errors */
  }
}

// Derive where the loan should be in the chain based on its server status.
// Used to seed a fresh state when localStorage has nothing for this loan.
// The chain is whatever the admin has configured via the settings page.
function deriveStepsFromLoanStatus(
  chain: ApprovalChainStep[],
  status: string
): ApprovalStep[] {
  const steps = buildFreshSteps(chain);
  if (steps.length === 0) return steps;

  const firstApproveIdx = steps.findIndex((s) => s.kind === "approve");
  const lastApproveIdx = (() => {
    for (let i = steps.length - 1; i >= 0; i--) {
      if (steps[i].kind === "approve") return i;
    }
    return -1;
  })();
  const releaseIdx = steps.findIndex((s) => s.kind === "release");

  if (status === "draft") {
    // Loan Processor (submit step, index 0) is pending
    return steps;
  }
  if (status === "for_review") {
    // Submit done; first approve step is pending
    steps[0] = { ...steps[0], status: "approved" };
    if (firstApproveIdx >= 0) {
      steps[firstApproveIdx] = { ...steps[firstApproveIdx], status: "pending" };
    }
    return steps;
  }
  if (status === "approved") {
    // All approve steps done; release step is pending
    for (let i = 0; i <= lastApproveIdx; i++) {
      steps[i] = { ...steps[i], status: "approved" };
    }
    if (releaseIdx >= 0) {
      steps[releaseIdx] = { ...steps[releaseIdx], status: "pending" };
    }
    return steps;
  }
  if (
    status === "released" ||
    status === "ongoing" ||
    status === "completed" ||
    status === "closed" ||
    status === "defaulted" ||
    status === "restructured"
  ) {
    // Full chain done
    return steps.map((s) => ({ ...s, status: "approved" }));
  }
  // draft-like fallback
  return steps;
}

// ── Borrower's Active Loans Component ──

const VISIBLE_LOAN_COUNT = 3;

function BorrowerActiveLoans({ loans, loading, approvalSteps, loanStatus, loan }: { loans: Loan[]; loading: boolean; approvalSteps: ApprovalStep[]; loanStatus: string; loan?: Loan }) {
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
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          Borrower&rsquo;s Active Loans
          <Badge variant="outline" className="ml-auto text-xs font-normal">
            {loading ? "Loading..." : `${loans.length} loan${loans.length !== 1 ? "s" : ""}`}
          </Badge>
        </CardTitle>
      </CardHeader>
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
    </Card>
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

export default function LoanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const loanId = Number(id);

  const [loan, setLoan] = useState<Loan | undefined>();
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [apiSchedule, setApiSchedule] = useState<LoanSchedule[] | null>(null);

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
  // the server will persist on release.
  const [previewSchedule, setPreviewSchedule] = useState<LoanSchedule[] | null>(null);

  // Statement of Account dialog state
  const [soaOpen, setSoaOpen] = useState(false);
  const [soaLoading, setSoaLoading] = useState(false);
  const [soaData, setSoaData] = useState<Record<string, unknown> | null>(null);

  // Repayments state
  const [repayments, setRepayments] = useState<Repayment[]>([]);
  const [repaymentsLoading, setRepaymentsLoading] = useState(false);
  const [recordPaymentOpen, setRecordPaymentOpen] = useState(false);
  const [paymentDate, setPaymentDate] = useState<Date>(new Date());
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentRemarks, setPaymentRemarks] = useState("");
  const [paymentDatePickerOpen, setPaymentDatePickerOpen] = useState(false);

  // Loan Adjustments state
  const [adjustments, setAdjustments] = useState<LoanAdjustment[]>([]);
  const [adjustmentsLoading, setAdjustmentsLoading] = useState(false);
  const [createAdjustmentOpen, setCreateAdjustmentOpen] = useState(false);
  const [adjType, setAdjType] = useState<LoanAdjustmentType>("balance_adjustment");
  const [adjDescription, setAdjDescription] = useState("");
  const [adjRemarks, setAdjRemarks] = useState("");
  const [adjNewValues, setAdjNewValues] = useState("");
  // User-friendly adjustment fields
  const [adjNewBalance, setAdjNewBalance] = useState("");
  const [adjNewInterestRate, setAdjNewInterestRate] = useState("");
  const [adjNewTerm, setAdjNewTerm] = useState("");
  const [adjNewFrequency, setAdjNewFrequency] = useState<string | null>(null);
  const [adjPenaltyAmount, setAdjPenaltyAmount] = useState("");

  // Loan Documents state
  const [docLoading, setDocLoading] = useState<string | null>(null);

  // Account Officer state
  const [users, setUsers] = useState<User[]>([]);
  const [aoEditing, setAoEditing] = useState(false);
  const [aoOpen, setAoOpen] = useState(false);
  const [aoSaving, setAoSaving] = useState(false);

  // Fetch loan on mount
  useEffect(() => {
    let cancelled = false;
    async function fetchLoan() {
      try {
        setLoading(true);
        const data = await loanService.detail(loanId);
        // Fetch co-makers from borrower endpoint when loan doesn't embed them
        const borrowerId = data.borrower?.id ?? data.borrower_id;
        if (borrowerId && (!data.co_makers || data.co_makers.length === 0)) {
          try {
            const cms = await coMakerService.list(borrowerId);
            const cmList = Array.isArray(cms) ? cms : (cms as unknown as { data: typeof cms }).data ?? [];
            if (cmList.length > 0) {
              data.co_makers = cmList.map((cm) => ({
                id: cm.id,
                full_name: cm.full_name ?? cm.name ?? ([cm.first_name, cm.middle_name, cm.last_name, cm.suffix].filter(Boolean).join(" ") || undefined),
                address: cm.address,
                relationship: cm.relationship_to_borrower ?? cm.relationship,
              }));
            }
          } catch { /* co-makers fetch is non-critical */ }
        }
        if (!cancelled) setLoan(data);
      } catch {
        if (!cancelled) toast.error("Failed to load loan details");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchLoan();
    return () => { cancelled = true; };
  }, [loanId]);

  // Fetch users for AO tagging
  useEffect(() => {
    async function fetchUsers() {
      try {
        const res = await userService.list();
        const list = Array.isArray(res) ? res : (res as unknown as { data: User[] }).data ?? [];
        setUsers(list.filter((u) => u.status === "active"));
      } catch { /* non-critical */ }
    }
    fetchUsers();
  }, []);

  // Save AO assignment
  const handleSaveAO = useCallback(async (userId: number) => {
    if (!loan) return;
    setAoSaving(true);
    try {
      await loanService.update(loan.id, { account_officer_id: userId } as Partial<Loan>);
      setLoan((prev) => prev ? { ...prev, account_officer_id: userId, account_officer: users.find((u) => u.id === userId) } as Loan : prev);
      toast.success("Account Officer updated");
      setAoEditing(false);
    } catch {
      toast.error("Failed to update Account Officer");
    } finally {
      setAoSaving(false);
    }
  }, [loan, users]);

  // Fetch schedule for released+ loans
  const fetchSchedule = useCallback(async (id: number) => {
    try {
      const res = await loanService.schedule(id);
      // API may return { schedule: [...], summary: {...} } or a plain array
      const rows = Array.isArray(res) ? res : (res as unknown as { schedule: unknown[] })?.schedule;
      if (Array.isArray(rows) && rows.length > 0) {
        // Map ApiScheduleRow field names to LoanSchedule field names
        const first = rows[0] as Record<string, unknown>;
        const isApiFormat = "principal_due" in first;
        setApiSchedule(
          isApiFormat
            ? (rows as Record<string, unknown>[]).map((r) => ({
                id: Number(r.id) || 0,
                loan_id: Number(r.loan_id) || id,
                due_date: String(r.due_date ?? ""),
                principal: parseFloat(String(r.principal_due ?? 0)),
                interest: parseFloat(String(r.interest_due ?? 0)),
                amount_due: parseFloat(String(r.total_due ?? 0)),
                amount_paid: parseFloat(String(r.principal_paid ?? 0)) + parseFloat(String(r.interest_paid ?? 0)),
                balance: parseFloat(String(r.remaining_balance ?? 0)),
                status: (r.status as LoanSchedule["status"]) ?? "pending",
              }) as LoanSchedule)
            : rows as unknown as LoanSchedule[]
        );
      } else {
        setApiSchedule([]);
      }
    } catch {
      setApiSchedule(null); // fallback to client-side generation
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

  // Fetch server-computed amortization preview for draft/for_review loans
  const fetchAmortizationPreview = useCallback(async (id: number) => {
    try {
      const res = await loanService.amortizationPreview(id);
      const rows = Array.isArray(res)
        ? res
        : ((res as unknown as { data?: LoanSchedule[] })?.data ?? []);
      setPreviewSchedule(rows);
    } catch {
      setPreviewSchedule(null);
    }
  }, []);

  useEffect(() => {
    if (loan && ["released", "ongoing", "completed", "defaulted", "restructured", "closed"].includes(loan.status)) {
      fetchSchedule(loan.id);
      fetchLoanSummary(loan.id);
    }
  }, [loan?.id, loan?.status, fetchSchedule, fetchLoanSummary]);

  // Pre-release preview (draft / for_review / approved)
  useEffect(() => {
    if (loan && ["draft", "for_review", "approved"].includes(loan.status)) {
      fetchAmortizationPreview(loan.id);
    }
  }, [loan?.id, loan?.status, fetchAmortizationPreview]);

  // Fetch repayments for released+ loans
  const fetchRepayments = useCallback(async (id: number) => {
    try {
      setRepaymentsLoading(true);
      const res = await repaymentService.list(id);
      setRepayments(Array.isArray(res) ? res : res.data ?? []);
    } catch {
      // silently fail
    } finally {
      setRepaymentsLoading(false);
    }
  }, []);

  // Fetch adjustments for released+ loans
  const fetchAdjustments = useCallback(async (id: number) => {
    try {
      setAdjustmentsLoading(true);
      const res = await loanAdjustmentService.list(id);
      setAdjustments(Array.isArray(res) ? res : []);
    } catch {
      // silently fail
    } finally {
      setAdjustmentsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (loan && ["released", "ongoing", "completed", "defaulted", "restructured", "closed"].includes(loan.status)) {
      fetchRepayments(loan.id);
      fetchAdjustments(loan.id);
    }
  }, [loan?.id, loan?.status, fetchRepayments, fetchAdjustments]);

  // Dialog state
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [releaseOpen, setReleaseOpen] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [releaseDatePickerOpen, setReleaseDatePickerOpen] = useState(false);

  const [approvalRemarks, setApprovalRemarks] = useState("");
  const [rejectionRemarks, setRejectionRemarks] = useState("");
  const [releaseDate, setReleaseDate] = useState<Date>(new Date());

  // Add-second-co-maker state (used inside Release Dialog)
  const [addCoMakerOpen, setAddCoMakerOpen] = useState(false);
  const [addingCoMaker, setAddingCoMaker] = useState(false);
  const [newCoMaker, setNewCoMaker] = useState({
    first_name: "",
    last_name: "",
    contact_number: "",
    relationship_to_borrower: "",
  });

  // Multi-step approval workflow (local state, persisted to localStorage)
  const [approvalSteps, setApprovalSteps] = useState<ApprovalStep[]>([]);
  const [approvalRounds, setApprovalRounds] = useState<RevisionRound[]>([]);
  const [stepRemarks, setStepRemarks] = useState("");
  const [stepActionLoading, setStepActionLoading] = useState(false);
  // Index of the step an approver is sending the loan back to. Defaults to
  // the most recent prior approver, falling back to the Loan Processor. See
  // `sendBackTargets` below for the list of valid choices.
  const [sendBackTargetIndex, setSendBackTargetIndex] = useState<number>(0);

  // Edit Loan Application dialog (used by Loan Processor after a send-back
  // and while the draft is still unsent)
  const [editOpen, setEditOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    principal_amount: "",
    interest_rate: "",
    start_date: "",
    scb_amount: "",
    purpose: "",
  });

  // Borrower's other active loans — shown during approval so officers can
  // see the borrower's existing obligations before approving.
  const [borrowerLoans, setBorrowerLoans] = useState<Loan[]>([]);
  const [borrowerLoansLoading, setBorrowerLoansLoading] = useState(false);
  // Chain configuration fetched from the approval-workflow service
  const [chainConfig, setChainConfig] = useState<ApprovalChainStep[] | null>(null);

  // Load the admin-configured chain based on policy_exception flag
  useEffect(() => {
    if (!loan) return;
    let cancelled = false;
    const isPolicyException = loan.policy_exception === true;
    approvalWorkflowService
      .listForLoan(isPolicyException)
      .then((chain) => {
        if (!cancelled) setChainConfig(chain);
      })
      .catch(() => {
        if (!cancelled) setChainConfig(
          isPolicyException
            ? approvalWorkflowService.getDefault()
            : approvalWorkflowService.getDefaultNormal()
        );
      });
    return () => {
      cancelled = true;
    };
  }, [loan?.id, loan?.policy_exception]);

  // Current logged-in user (used to gate approval actions by role)
  const currentUser = useAuthStore((s) => s.user);
  const currentUserDisplayName =
    currentUser?.full_name ||
    [currentUser?.first_name, currentUser?.last_name].filter(Boolean).join(" ") ||
    currentUser?.username ||
    "Unknown User";

  // Amortization schedule preview for release dialog
  const releaseSchedule = useMemo(() => {
    if (!loan) return [];
    const termVal = loan.term ?? loan.term_months ?? 0;
    const freqVal = (loan.frequency ?? loan.payment_frequency ?? "monthly") as Parameters<typeof generateSchedule>[3];
    const methodVal = (loan.interest_method ?? loan.interest_type ?? "fixed") as Parameters<typeof generateSchedule>[4];
    return generateSchedule(
      loan.principal_amount,
      loan.interest_rate,
      termVal,
      freqVal,
      methodVal,
      releaseDate,
      loan.scb_amount ?? 0,
    );
  }, [loan?.principal_amount, loan?.interest_rate, loan?.term, loan?.term_months, loan?.frequency, loan?.payment_frequency, loan?.interest_method, loan?.interest_type, loan?.scb_amount, releaseDate]);

  const scheduleTotals = useMemo(() => {
    return releaseSchedule.reduce(
      (acc, row) => ({
        principal: acc.principal + row.principal,
        interest: acc.interest + row.interest,
        shareCapitalBuildUp: acc.shareCapitalBuildUp + row.shareCapitalBuildUp,
        totalPayment: acc.totalPayment + row.totalPayment,
      }),
      { principal: 0, interest: 0, shareCapitalBuildUp: 0, totalPayment: 0 },
    );
  }, [releaseSchedule]);

  // Maturity date computed from release date + term
  const computedMaturityDate = useMemo(() => {
    if (!loan) return null;
    return addMonths(releaseDate, loan.term ?? loan.term_months ?? 0);
  }, [releaseDate, loan?.term, loan?.term_months]);

  // Post-release: prefer API schedule, fallback to client-side generation
  const storedSchedule = useMemo(() => {
    if (!loan) return [];
    const relDate = loan.released_at ?? loan.start_date ?? loan.release_date;
    if (!relDate) return [];
    const isReleased = ["released", "ongoing", "completed", "defaulted", "restructured", "closed"].includes(loan.status);
    if (!isReleased) return [];
    // Use API schedule if available, map to display format
    const scb = loan.scb_amount ?? 0;
    if (apiSchedule && apiSchedule.length > 0) {
      return apiSchedule.map((row, idx) => ({
        period: idx + 1,
        dueDate: new Date(row.due_date),
        principal: parseFloat(String(row.principal)) || 0,
        interest: parseFloat(String(row.interest)) || 0,
        shareCapitalBuildUp: scb,
        totalPayment: (parseFloat(String(row.amount_due)) || 0) + scb,
        balance: parseFloat(String(row.balance)) || 0,
      }));
    }
    // Fallback to client-side generation
    const termVal = loan.term ?? loan.term_months ?? 0;
    const freqVal = (loan.frequency ?? loan.payment_frequency ?? "monthly") as Parameters<typeof generateSchedule>[3];
    const methodVal = (loan.interest_method ?? loan.interest_type ?? "fixed") as Parameters<typeof generateSchedule>[4];
    return generateSchedule(
      loan.principal_amount,
      loan.interest_rate,
      termVal,
      freqVal,
      methodVal,
      new Date(relDate),
      scb,
    );
  }, [loan?.principal_amount, loan?.interest_rate, loan?.term, loan?.term_months, loan?.frequency, loan?.payment_frequency, loan?.interest_method, loan?.interest_type, loan?.scb_amount, loan?.released_at, loan?.start_date, loan?.release_date, loan?.status, apiSchedule]);

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

  // Seed/load multi-step approval state whenever the loan or chain config changes.
  // The chain is visible for every status except "rejected" (voided drafts).
  useEffect(() => {
    if (!loan || !chainConfig) return;
    if (loan.status === "rejected") {
      setApprovalSteps([]);
      setApprovalRounds([]);
      return;
    }
    const stored = loadApprovalState(loan.id);
    if (stored) {
      setApprovalSteps(stored.current_steps);
      setApprovalRounds(stored.rounds);
    } else {
      setApprovalSteps(deriveStepsFromLoanStatus(chainConfig, loan.status));
      setApprovalRounds([]);
    }
  }, [loan?.id, loan?.status, chainConfig]);

  // Fetch borrower's other active loans when viewing a loan under approval.
  // This lets approvers see the borrower's existing obligations.
  useEffect(() => {
    if (!loan) return;
    const borrowerId = loan.borrower?.id ?? loan.borrower_id;
    if (!borrowerId) return;
    let cancelled = false;
    setBorrowerLoansLoading(true);
    loanService
      .list({ borrower_id: borrowerId, per_page: 50 })
      .then((result) => {
        if (cancelled) return;
        const items = Array.isArray(result)
          ? result
          : (result as { data?: Loan[] }).data ?? [];
        // Exclude the current loan and only show active ones
        setBorrowerLoans(
          items.filter(
            (l) =>
              l.id !== loan.id &&
              ["released", "ongoing", "for_review", "approved"].includes(l.status)
          )
        );
      })
      .catch(() => {
        if (!cancelled) setBorrowerLoans([]);
      })
      .finally(() => {
        if (!cancelled) setBorrowerLoansLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loan?.id, loan?.borrower?.id, loan?.borrower_id]);

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

  // When the set of valid targets changes, default to the most recent prior
  // approver (or the Loan Processor if there is none).
  useEffect(() => {
    if (sendBackTargets.length > 0) {
      setSendBackTargetIndex(
        sendBackTargets[sendBackTargets.length - 1].index
      );
    }
  }, [sendBackTargets]);

  const isLocked = loan ? ["released", "ongoing", "completed", "defaulted", "restructured", "closed"].includes(loan.status) : false;

  // Resolve actual API field names with fallbacks to legacy flat fields
  const loanBorrowerName = loan?.borrower?.full_name ?? loan?.borrower?.name ?? loan?.borrower_name ?? "";
  const loanCoMakerName = (() => {
    const cm = loan?.co_makers?.[0];
    if (!cm) return loan?.co_maker_name ?? "";
    return cm.full_name ?? cm.name ?? ([cm.first_name, cm.middle_name, cm.last_name, cm.suffix].filter(Boolean).join(" ") || "");
  })();
  const loanProductName = loan?.loan_product?.name ?? loan?.loan_product_name ?? "";
  const loanInterestType = loan?.interest_method ?? loan?.interest_type ?? "";
  const loanTerm = loan?.term ?? loan?.term_months ?? 0;
  const loanFrequency = loan?.frequency ?? loan?.payment_frequency ?? "";
  const loanProcessingFee = loan?.deductions?.processing_fee ?? loan?.processing_fee ?? 0;
  const loanServiceFee = loan?.deductions?.service_fee ?? loan?.service_fee ?? 0;
  const loanOtherDeductions = (loan?.total_deductions ?? 0) - loanProcessingFee - loanServiceFee;
  const loanReleaseDate = loan?.released_at ?? loan?.start_date ?? loan?.release_date;
  const loanApprovedBy = loan?.approved_by_user?.full_name ?? loan?.approved_by_user?.name ?? loan?.approved_by;
  const loanReleasedBy = loan?.released_by_user?.full_name ?? loan?.released_by_user?.name ?? loan?.released_by;
  const loanRejectedBy = loan?.created_by_user?.full_name ?? loan?.rejected_by; // TODO: actual rejected_by_user
  const loanTotalPayable = loan?.total_payable ?? (storedSchedule.length > 0 ? storedSchedule.reduce((sum, r) => sum + r.totalPayment, 0) : 0);

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-6rem)] items-center justify-center">
        <Spinner className="size-6 text-muted-foreground" />
      </div>
    );
  }

  if (!loan) {
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

  const handleSubmitForReview = async () => {
    try {
      setActionLoading(true);
      const updated = await loanService.submit(loan.id);
      setLoan(updated);
      toast.success("Loan submitted for review");
      setSubmitOpen(false);
    } catch {
      toast.error("Failed to submit loan for review");
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = async () => {
    try {
      setActionLoading(true);
      const updated = await loanService.approve(loan.id, {
        approval_remarks: approvalRemarks || undefined,
      });
      setLoan(updated);
      toast.success("Loan approved");
      setApprovalRemarks("");
      setApproveOpen(false);
    } catch {
      toast.error("Failed to approve loan");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionRemarks.trim()) return;
    try {
      setActionLoading(true);
      const updated = await loanService.reject(loan.id, {
        approval_remarks: rejectionRemarks,
      });
      setLoan(updated);
      toast.success("Loan rejected");
      setRejectionRemarks("");
      setRejectOpen(false);
    } catch {
      toast.error("Failed to reject loan");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRelease = async () => {
    try {
      setActionLoading(true);
      const updated = await loanService.release(loan.id);
      setLoan(updated);
      toast.success("Loan released successfully");
      setReleaseOpen(false);
      // Fetch the server-generated schedule
      fetchSchedule(loan.id);
      // Mark the Cashier step approved in the local approval chain
      if (approvalSteps.length > 0) {
        const actedAt = new Date().toISOString();
        const updatedSteps = approvalSteps.map((s) =>
          s.kind === "release" && s.status === "pending"
            ? {
                ...s,
                status: "approved" as ApprovalStepStatus,
                acted_at: actedAt,
                acted_by: currentUserDisplayName,
              }
            : s
        );
        persistApprovalState(updatedSteps, approvalRounds);
      }
    } catch {
      toast.error("Failed to release loan");
    } finally {
      setActionLoading(false);
    }
  };

  // ── Multi-step approval handlers ──

  const currentStepIndex = approvalSteps.findIndex((s) => s.status === "pending");
  const currentStep = currentStepIndex >= 0 ? approvalSteps[currentStepIndex] : null;
  // Confirmation step = the last approve step (next step is release). Its button
  // reads "Confirm & Forward" instead of "Approve & Forward" to signal the
  // chairwoman's role as final confirmation before release.
  const isConfirmationStep =
    currentStep?.kind === "approve" &&
    approvalSteps[currentStepIndex + 1]?.kind === "release";
  const allStepsApproved =
    approvalSteps.length > 0 && approvalSteps.every((s) => s.status === "approved");
  const canActOnCurrentStep = currentStep
    ? canUserActOnStep(currentStep, currentUser?.roles)
    : false;

  const persistApprovalState = (steps: ApprovalStep[], rounds: RevisionRound[]) => {
    if (!loan) return;
    setApprovalSteps(steps);
    setApprovalRounds(rounds);
    saveApprovalState(loan.id, { current_steps: steps, rounds });
  };

  // Edit Loan Application — available to the Loan Processor while the loan
  // is still a draft OR has been sent back by an approver. Seeds the form
  // from the current loan values and opens the dialog.
  const canEditLoanApplication =
    !!loan &&
    !isLocked &&
    loan.status !== "rejected" &&
    !!currentStep &&
    currentStep.kind === "submit" &&
    canActOnCurrentStep;

  const handleOpenEdit = () => {
    if (!loan) return;
    setEditForm({
      principal_amount: String(loan.principal_amount ?? ""),
      interest_rate: String(loan.interest_rate ?? ""),
      start_date: (loan.start_date ?? "").slice(0, 10),
      scb_amount: String(loan.scb_amount ?? ""),
      purpose: loan.purpose ?? "",
    });
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!loan) return;
    const principal = parseFloat(editForm.principal_amount);
    const rate = parseFloat(editForm.interest_rate);
    if (!Number.isFinite(principal) || principal <= 0) {
      toast.error("Principal amount must be greater than zero");
      return;
    }
    if (!Number.isFinite(rate) || rate < 0) {
      toast.error("Interest rate must be a valid number");
      return;
    }
    if (!editForm.start_date) {
      toast.error("Start date is required");
      return;
    }
    const scb = editForm.scb_amount ? parseFloat(editForm.scb_amount) : 0;
    try {
      setEditSaving(true);
      const payload: Partial<Loan> = {
        principal_amount: principal,
        interest_rate: rate,
        start_date: editForm.start_date,
        scb_amount: Number.isFinite(scb) ? scb : 0,
        purpose: editForm.purpose.trim() || undefined,
      } as Partial<Loan>;
      const updated = await loanService.update(loan.id, payload);
      setLoan(updated);
      toast.success("Loan application updated");
      setEditOpen(false);
    } catch {
      toast.error("Failed to update loan application");
    } finally {
      setEditSaving(false);
    }
  };

  // Step 0 (Loan Processor): Submit the draft for review.
  // Moves loan status draft → for_review via the existing loanService.submit(),
  // marks Loan Processor step approved and Manager step pending.
  const handleStepSubmit = async () => {
    if (!loan || !currentStep || currentStep.kind !== "submit") return;
    if (!canActOnCurrentStep) {
      toast.error(`Only a user with the ${currentStep.role} role can submit the draft`);
      return;
    }
    try {
      setStepActionLoading(true);
      const updatedLoan = await loanService.submit(loan.id);
      setLoan(updatedLoan);
      const actedAt = new Date().toISOString();
      const updatedSteps: ApprovalStep[] = approvalSteps.map((s, i) => {
        if (i === 0) {
          return {
            ...s,
            status: "approved",
            remarks: stepRemarks.trim() || undefined,
            acted_at: actedAt,
            acted_by: currentUserDisplayName,
          };
        }
        if (i === 1) {
          return { ...s, status: "pending" };
        }
        return s;
      });
      persistApprovalState(updatedSteps, approvalRounds);
      setStepRemarks("");
      toast.success("Submitted for review. Forwarded to Manager.");
    } catch {
      toast.error("Failed to submit for review");
    } finally {
      setStepActionLoading(false);
    }
  };

  // Steps 1-8 (Manager + BOD1..BOD7): Approve & Forward.
  // Marks the current step approved and the next step pending. On the last
  // approver step, calls the real loanService.approve() to move the loan's
  // server status from for_review → approved (so Cashier step becomes actionable).
  const handleStepApprove = async () => {
    if (!loan || !currentStep || currentStep.kind !== "approve") return;
    if (!canActOnCurrentStep) {
      toast.error(`Only a user with the ${currentStep.role} role can approve this step`);
      return;
    }
    try {
      setStepActionLoading(true);
      const actedAt = new Date().toISOString();
      const updatedSteps: ApprovalStep[] = approvalSteps.map((s, i) => {
        if (i === currentStep.index) {
          return {
            ...s,
            status: "approved",
            remarks: stepRemarks.trim() || undefined,
            acted_at: actedAt,
            acted_by: currentUserDisplayName,
          };
        }
        if (i === currentStep.index + 1) {
          return { ...s, status: "pending" };
        }
        return s;
      });
      setStepRemarks("");

      // Was this the last approver (step 8, BOD7)? If so, flip server status.
      const nextStep = updatedSteps[currentStep.index + 1];
      const isLastApprover = nextStep?.kind === "release";
      if (isLastApprover) {
        const updatedLoan = await loanService.approve(loan.id, {
          approval_remarks: stepRemarks.trim() || undefined,
        });
        setLoan(updatedLoan);
      }
      persistApprovalState(updatedSteps, approvalRounds);
      toast.success(
        `Approved by ${currentStep.name}. Forwarded to ${nextStep?.name ?? "next step"}.`
      );
    } catch {
      toast.error("Failed to record approval");
    } finally {
      setStepActionLoading(false);
    }
  };

  // Steps 1-8: Send Back for Revision.
  // This is the flowchart's "Approved? = No" branch. Instead of killing the
  // loan, it snapshots the current round, resets the chain, and puts the loan
  // back on the Loan Processor's desk. Note: there is no backend call because
  // no "send-back" endpoint exists yet — the loan server status stays at
  // for_review while the local chain is reset. Loan Processor can then submit
  // again to restart the chain.
  const handleStepSendBack = async (targetIndex: number) => {
    if (!loan || !currentStep || currentStep.kind !== "approve") return;
    if (!canActOnCurrentStep) {
      toast.error(
        `Only a user with the ${currentStep.role} role can send back this loan`
      );
      return;
    }
    if (!stepRemarks.trim()) {
      toast.error("Please enter a reason before sending back for revision");
      return;
    }
    if (
      targetIndex < 0 ||
      targetIndex >= currentStep.index ||
      approvalSteps[targetIndex] === undefined
    ) {
      toast.error("Invalid send-back target");
      return;
    }
    const targetStep = approvalSteps[targetIndex];
    try {
      setStepActionLoading(true);
      const actedAt = new Date().toISOString();

      // Snapshot the current progress as a completed revision round
      const roundSteps: ApprovalStep[] = approvalSteps.map((s, i) => {
        if (i === currentStep.index) {
          return {
            ...s,
            status: "sent_back",
            remarks: stepRemarks.trim(),
            acted_at: actedAt,
            acted_by: currentUserDisplayName,
          };
        }
        return s;
      });
      const nextRound: RevisionRound = {
        round: approvalRounds.length + 1,
        steps: roundSteps,
        sent_back_by: currentUserDisplayName,
        sent_back_at: actedAt,
        sent_back_remarks: `To ${targetStep.name}: ${stepRemarks.trim()}`,
      };

      // Rebuild the chain so `targetStep` is pending again. Steps before the
      // target keep their prior approval intact (so the approver doesn't have
      // to re-act on them); steps from the target onward are reset to waiting,
      // except the target itself which becomes pending.
      const freshSteps: ApprovalStep[] = approvalSteps.map((s, i) => {
        if (i < targetIndex) {
          return { ...s, status: "approved" as ApprovalStepStatus };
        }
        if (i === targetIndex) {
          return {
            index: s.index,
            name: s.name,
            role: s.role,
            kind: s.kind,
            status: "pending" as ApprovalStepStatus,
          };
        }
        return {
          index: s.index,
          name: s.name,
          role: s.role,
          kind: s.kind,
          status: "waiting" as ApprovalStepStatus,
        };
      });
      persistApprovalState(freshSteps, [...approvalRounds, nextRound]);
      setStepRemarks("");
      toast.success(
        `${currentStep.name} sent the loan back to ${targetStep.name} for revision.`
      );
    } catch {
      toast.error("Failed to send back for revision");
    } finally {
      setStepActionLoading(false);
    }
  };

  // Step 9 (Cashier): Release the loan.
  // Opens the existing Release Loan dialog (co-maker addition, release date,
  // amortization preview, etc.). The existing handleRelease() handler takes
  // care of the real API call and marks the step approved on success.
  const handleStepRelease = () => {
    if (!loan || !currentStep || currentStep.kind !== "release") return;
    if (!canActOnCurrentStep) {
      toast.error(`Only a user with the ${currentStep.role} role can release this loan`);
      return;
    }
    setReleaseOpen(true);
  };

  const handleAddSecondCoMaker = async () => {
    if (!loan) return;
    const borrowerId = loan.borrower?.id ?? loan.borrower_id;
    if (!borrowerId) {
      toast.error("Borrower not found");
      return;
    }
    if (!newCoMaker.first_name.trim() || !newCoMaker.last_name.trim()) {
      toast.error("First name and last name are required");
      return;
    }
    try {
      setAddingCoMaker(true);
      const created = await coMakerService.create(borrowerId, {
        first_name: newCoMaker.first_name.trim(),
        last_name: newCoMaker.last_name.trim(),
        contact_number: newCoMaker.contact_number.trim() || undefined,
        relationship_to_borrower:
          newCoMaker.relationship_to_borrower.trim() || undefined,
      });
      // Append to loan.co_makers so the Release Dialog reflects the new co-maker
      setLoan((prev) => {
        if (!prev) return prev;
        const fullName =
          created.full_name ??
          [created.first_name, created.middle_name, created.last_name, created.suffix]
            .filter(Boolean)
            .join(" ");
        const appended = {
          id: created.id,
          full_name: fullName,
          address: created.address,
          relationship:
            created.relationship_to_borrower ?? created.relationship,
        };
        return { ...prev, co_makers: [...(prev.co_makers ?? []), appended] };
      });
      toast.success("Co-maker added");
      setAddCoMakerOpen(false);
      setNewCoMaker({
        first_name: "",
        last_name: "",
        contact_number: "",
        relationship_to_borrower: "",
      });
    } catch {
      toast.error("Failed to add co-maker");
    } finally {
      setAddingCoMaker(false);
    }
  };

  // ── Repayment Handlers ──

  const handleRecordPayment = async () => {
    if (!paymentAmount || Number(paymentAmount) <= 0) return;
    try {
      setActionLoading(true);
      await repaymentService.create(loan.id, {
        payment_date: formatDateISO(paymentDate),
        amount_paid: Number(paymentAmount),
        remarks: paymentRemarks || undefined,
      });
      toast.success("Payment recorded");
      setRecordPaymentOpen(false);
      setPaymentAmount("");
      setPaymentRemarks("");
      setPaymentDate(new Date());
      fetchRepayments(loan.id);
      const updated = await loanService.detail(loan.id);
      setLoan(updated);
    } catch {
      toast.error("Failed to record payment");
    } finally {
      setActionLoading(false);
    }
  };

  const handleVoidRepayment = async (repaymentId: number) => {
    const reason = prompt("Reason for voiding this payment:");
    if (!reason?.trim()) return;
    try {
      setActionLoading(true);
      await repaymentService.void(repaymentId, { void_reason: reason });
      toast.success("Payment voided");
      fetchRepayments(loan.id);
      const updated = await loanService.detail(loan.id);
      setLoan(updated);
    } catch {
      toast.error("Failed to void payment");
    } finally {
      setActionLoading(false);
    }
  };

  const handleVoidLoan = async () => {
    try {
      setActionLoading(true);
      await loanService.void(loan.id);
      toast.success("Loan voided");
      const updated = await loanService.detail(loan.id);
      setLoan(updated);
    } catch {
      toast.error("Failed to void loan");
    } finally {
      setActionLoading(false);
    }
  };

  // ── Loan Adjustment Handlers ──

  const handleCreateAdjustment = async () => {
    // Build new_values from user-friendly fields based on type
    const newValues: Record<string, unknown> = {};
    if (adjType === "balance_adjustment") {
      if (!adjNewBalance) { toast.error("Please enter the new balance amount"); return; }
      newValues.outstanding_balance = parseFloat(adjNewBalance);
    } else if (adjType === "restructure") {
      if (adjNewInterestRate) newValues.interest_rate = parseFloat(adjNewInterestRate);
      if (adjNewTerm) newValues.term = parseInt(adjNewTerm);
      if (adjNewFrequency) newValues.frequency = adjNewFrequency;
      if (Object.keys(newValues).length === 0) { toast.error("Please fill in at least one field to restructure"); return; }
    } else if (adjType === "penalty_waiver") {
      if (!adjPenaltyAmount) { toast.error("Please enter the penalty amount to waive"); return; }
      newValues.penalty_waived = parseFloat(adjPenaltyAmount);
    } else if (adjType === "term_extension") {
      if (!adjNewTerm) { toast.error("Please enter the additional months"); return; }
      newValues.additional_months = parseInt(adjNewTerm);
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
      setAdjDescription("");
      setAdjRemarks("");
      setAdjNewValues("");
      setAdjNewBalance("");
      setAdjNewInterestRate("");
      setAdjNewTerm("");
      setAdjNewFrequency(null);
      setAdjPenaltyAmount("");
      fetchAdjustments(loan.id);
    } catch {
      toast.error("Failed to create adjustment");
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
        const updated = await loanService.detail(loan.id);
        setLoan(updated);
      }
      fetchAdjustments(loan.id);
    } catch {
      toast.error(`Failed to ${action} adjustment`);
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
      toast.error("Failed to fetch statement of account");
      setSoaData(null);
    } finally {
      setSoaLoading(false);
    }
  };

  // ── Loan Document Handlers ──

  const handleDownloadDocument = async (type: "disclosure" | "promissory-note") => {
    try {
      setDocLoading(type);

      if (type === "disclosure") {
        try {
          const apiData = await loanDocumentService.disclosure(loan.id);
          if (apiData && apiData.borrower_name) {
            const html = generateDisclosureHTML(apiData);
            const blob = new Blob([html], { type: "text/html" });
            const url = URL.createObjectURL(blob);
            window.open(url, "_blank");
            toast.success("Disclosure Statement opened");
            return;
          }
        } catch {
          // Fall through to local extraction
        }
      } else {
        try {
          const apiData = await loanDocumentService.promissoryNote(loan.id);
          if (apiData && apiData.borrower_name) {
            const html = generatePromissoryNoteHTML(apiData);
            const blob = new Blob([html], { type: "text/html" });
            const url = URL.createObjectURL(blob);
            window.open(url, "_blank");
            toast.success("Promissory Note opened");
            return;
          }
        } catch {
          // Fall through to local extraction
        }
      }

      // Access actual API fields (differ from TS types)
      const raw = loan as unknown as Record<string, unknown>;
      const borrowerObj = raw.borrower as Record<string, unknown> | undefined;
      const borrowerName = (borrowerObj?.full_name ?? borrowerObj?.name ?? "") as string;
      const coMakersArr = raw.co_makers as Record<string, unknown>[] | undefined;
      const coMakerName = coMakersArr?.[0] ? ((coMakersArr[0].full_name ?? coMakersArr[0].name ?? ([coMakersArr[0].first_name, coMakersArr[0].middle_name, coMakersArr[0].last_name, coMakersArr[0].suffix].filter(Boolean).join(" "))) as string || undefined) : undefined;
      const principal = parseFloat(String(raw.principal_amount ?? 0));
      const rate = parseFloat(String(raw.interest_rate ?? 0));
      const interestMethod = String(raw.interest_method ?? "");
      const term = Number(raw.term ?? 0);
      const frequency = String(raw.frequency ?? "");
      const netProceeds = parseFloat(String(raw.net_proceeds ?? 0));
      const totalDeductionsVal = parseFloat(String(raw.total_deductions ?? 0));
      const deductions = raw.deductions as Record<string, unknown> | undefined;
      const processingFee = parseFloat(String(deductions?.processing_fee ?? 0));
      const serviceFee = parseFloat(String(deductions?.service_fee ?? 0));
      const otherDeductions = totalDeductionsVal - processingFee - serviceFee;
      const appNumber = String(raw.application_number ?? raw.loan_account_number ?? "");
      const startDate = String(raw.start_date ?? "");
      const maturityDate = String(raw.maturity_date ?? "");
      const releasedAt = String(raw.released_at ?? raw.start_date ?? "");

      // Build schedule from apiSchedule or embedded amortization_schedules
      const scheduleSource = apiSchedule && apiSchedule.length > 0
        ? apiSchedule
        : (raw.amortization_schedules as Record<string, unknown>[] | undefined) ?? [];
      const schedule = (scheduleSource as Record<string, unknown>[]).map((s, i) => ({
        period: i + 1,
        due_date: String(s.due_date ?? ""),
        principal: parseFloat(String(s.principal ?? s.principal_due ?? 0)),
        interest: parseFloat(String(s.interest ?? s.interest_due ?? 0)),
        amount_due: parseFloat(String(s.amount_due ?? s.total_due ?? 0)),
        balance: parseFloat(String(s.balance ?? s.remaining_balance ?? 0)),
      }));

      const totalPayable = schedule.length > 0
        ? schedule.reduce((sum, s) => sum + s.amount_due, 0)
        : principal + (principal * rate / 100 * term);

      let html: string;
      if (type === "disclosure") {
        html = generateDisclosureHTML({
          loan_id: loan.id,
          application_number: appNumber || undefined,
          borrower_name: borrowerName,
          principal_amount: principal,
          interest_rate: rate,
          interest_type: interestMethod,
          term_months: term,
          payment_frequency: frequency,
          processing_fee: processingFee,
          service_fee: serviceFee,
          other_deductions: otherDeductions > 0 ? otherDeductions : 0,
          net_proceeds: netProceeds || principal - totalDeductionsVal,
          total_payable: totalPayable,
          amortization_schedule: schedule,
        });
      } else {
        html = generatePromissoryNoteHTML({
          loan_id: loan.id,
          application_number: appNumber || undefined,
          borrower_name: borrowerName,
          co_maker_name: coMakerName,
          principal_amount: principal,
          interest_rate: rate,
          interest_type: interestMethod,
          term_months: term,
          payment_frequency: frequency,
          total_payable: totalPayable,
          maturity_date: maturityDate || undefined,
          release_date: releasedAt || startDate || undefined,
        });
      }
      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      toast.success(`${type === "disclosure" ? "Disclosure Statement" : "Promissory Note"} opened`);
    } catch (err) {
      console.error("Document generation error:", err);
      toast.error(`Failed to generate ${type === "disclosure" ? "disclosure statement" : "promissory note"}`);
    } finally {
      setDocLoading(null);
    }
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
                  className={cn("text-sm px-3 py-1", statusColors[loan.status])}
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
                  className={cn("text-sm px-3 py-1", statusColors[loan.status])}
                >
                  {LOAN_STATUS_LABELS[loan.status] ?? loan.status}
                </Badge>
              )}
            </div>
            <p className="text-lg text-foreground">{loanBorrowerName}</p>
          </div>
        </div>
      </div>


      {loan.status !== "rejected" && approvalSteps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
              Loan Approval Process
              <Badge variant="outline" className="ml-auto text-xs font-normal">
                {allStepsApproved
                  ? "Complete"
                  : currentStep
                    ? `Step ${currentStep.index + 1} of ${approvalSteps.length}`
                    : `${approvalSteps.length} steps`}
              </Badge>
            </CardTitle>
            {approvalRounds.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                Revision {approvalRounds.length + 1} — previously sent back{" "}
                {approvalRounds.length} time{approvalRounds.length !== 1 ? "s" : ""}
              </p>
            )}
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Horizontal progress tracker — all 10 steps at a glance.
                Circles are clickable: click any step to view/act on it below.
                The currently-selected step is marked with an orange ring. */}
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
                            <Clock className="h-3.5 w-3.5" />
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
                          (currentStep.index < approvalSteps.length - 2
                            ? ` — on approve, the loan will be forwarded to ${
                                approvalSteps[currentStep.index + 1].name
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
                          {canEditLoanApplication && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full sm:w-auto"
                              onClick={handleOpenEdit}
                              disabled={stepActionLoading || editSaving}
                            >
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit Loan Application
                            </Button>
                          )}
                          <Button
                            size="sm"
                            className="w-full sm:w-auto bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark"
                            onClick={handleStepSubmit}
                            disabled={stepActionLoading}
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
                                  : 0
                              )
                            }
                            disabled={stepActionLoading || !stepRemarks.trim()}
                          >
                            <XCircle className="mr-2 h-4 w-4" />
                            Send Back for Revision
                          </Button>
                          <Button
                            size="sm"
                            className="w-full sm:w-auto bg-green-600 text-white hover:bg-green-700"
                            onClick={handleStepApprove}
                            disabled={stepActionLoading}
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
                          disabled={stepActionLoading}
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
        </Card>
      )}

      {/* The "Release Loan" action has moved to the Approval Chain card
          (Cashier step). Kept here as a no-op placeholder block to document
          the migration — can be deleted once the chain is backend-wired. */}

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

            <div className="grid grid-cols-2 gap-4">
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
                  Interest Rate
                  {isLocked && <Lock className="h-3 w-3 text-muted-foreground" />}
                </p>
                <p className="text-sm font-medium">{loan.interest_rate}%</p>
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
                  {loanTerm} months
                </p>
              </div>
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
                  {formatCurrency(loanTotalPayable)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Net Proceeds</p>
                <p className="text-sm font-semibold">
                  {loan.net_proceeds != null
                    ? formatCurrency(loan.net_proceeds)
                    : "N/A"}
                </p>
              </div>
            </div>

            <Separator />

            {/* Deductions */}
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Deductions</p>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Processing Fee
                </span>
                <span className="text-sm font-medium">
                  {formatCurrency(loanProcessingFee)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Service Fee
                </span>
                <span className="text-sm font-medium">
                  {formatCurrency(loanServiceFee)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Other Deductions
                </span>
                <span className="text-sm font-medium">
                  {formatCurrency(loanOtherDeductions > 0 ? loanOtherDeductions : 0)}
                </span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">Total Deductions</span>
                <span className="text-sm font-semibold">
                  {formatCurrency(totalDeductions)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Borrower's Active Loans */}
        <BorrowerActiveLoans
          loans={borrowerLoans}
          loading={borrowerLoansLoading}
          approvalSteps={approvalSteps}
          loanStatus={loan.status}
          loan={loan}
        />

        {/* Card 3: Member & Co-Maker */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-muted-foreground" />
              Member & Co-Maker
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-xs text-muted-foreground">Member</p>
              <p className="text-sm font-medium">
                {loanBorrowerName || "N/A"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Co-Maker</p>
              <p className="text-sm font-medium">
                {loanCoMakerName || "None"}
              </p>
            </div>
            <Separator />
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-muted-foreground">Account Officer (AO)</p>
                {!aoEditing && (
                  <button
                    type="button"
                    onClick={() => setAoEditing(true)}
                    className="text-xs text-brand-orange hover:underline flex items-center gap-1"
                  >
                    <Pencil className="h-3 w-3" />
                    {(loan as unknown as Record<string, unknown>).account_officer_id ? "Change" : "Assign"}
                  </button>
                )}
              </div>
              {aoEditing ? (
                <div className="space-y-2">
                  <Popover open={aoOpen} onOpenChange={setAoOpen}>
                    <PopoverTrigger
                      render={
                        <button
                          type="button"
                          role="combobox"
                          disabled={aoSaving}
                          className="flex h-8 w-full items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-2.5 text-sm transition-colors hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                        />
                      }
                    >
                      <span className="text-muted-foreground text-sm">Select account officer...</span>
                      <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
                    </PopoverTrigger>
                    <PopoverContent className="w-(--anchor-width) p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search officer..." />
                        <CommandList>
                          <CommandEmpty>No users found.</CommandEmpty>
                          <CommandGroup>
                            {users.map((user) => (
                              <CommandItem
                                key={user.id}
                                value={user.full_name}
                                onSelect={() => {
                                  handleSaveAO(user.id);
                                  setAoOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 size-4",
                                    (loan as unknown as Record<string, unknown>).account_officer_id === user.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <div>
                                  <p className="text-sm">{user.full_name}</p>
                                  <p className="text-xs text-muted-foreground capitalize">{user.roles?.[0]?.replace("_", " ") ?? ""}</p>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
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
                  {(() => {
                    const ao = (loan as unknown as Record<string, unknown>).account_officer as { id?: number; full_name?: string; name?: string } | undefined;
                    return ao?.full_name ?? ao?.name ?? "Not assigned";
                  })()}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Workflow History */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Workflow History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <WorkflowHistory loan={loan} />
          </CardContent>
        </Card>
      </div>

      {/* Release Details — only for released+ loans */}
      {isLocked && loan.release_date && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Unlock className="h-4 w-4 text-cyan-600" />
              Release Details
              {loanSummary && (
                <Badge variant="outline" className="text-[10px] bg-green-500/10 text-green-700 border-green-500/30">
                  Server-verified
                </Badge>
              )}
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenStatementOfAccount}
            >
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
                  {loanSummary?.next_due_date
                    ? formatDate(loanSummary.next_due_date)
                    : loan.next_due_date
                      ? formatDate(loan.next_due_date)
                      : "—"}
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
          </CardContent>
        </Card>
      )}

      {/* Server-verified preview (pre-release) */}
      {loan && ["draft", "for_review", "approved"].includes(loan.status) && previewSchedule && previewSchedule.length > 0 && (
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="py-3">
            <div className="flex items-center gap-2 text-xs">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span className="font-semibold text-green-700 dark:text-green-400">
                Server-verified amortization preview loaded
              </span>
              <Badge variant="outline" className="text-[10px] bg-green-500/10 text-green-700 border-green-500/30">
                {previewSchedule.length} installments
              </Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              The backend computed {previewSchedule.length} periodic payments. This preview matches what will be persisted on release.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Amortization Schedule — only for released+ loans */}
      {storedSchedule.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              Amortization Schedule
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12 text-center">#</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead className="text-right">Principal</TableHead>
                    <TableHead className="text-right">Interest</TableHead>
                    {storedScheduleTotals.shareCapitalBuildUp > 0 && (
                      <TableHead className="text-right">Share Capital Build-Up</TableHead>
                    )}
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
                      {storedScheduleTotals.shareCapitalBuildUp > 0 && (
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
                    {storedScheduleTotals.shareCapitalBuildUp > 0 && (
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
          </CardContent>
        </Card>
      )}

      {/* Loan Documents — only for approved+ loans */}
      {loan.status !== "draft" && loan.status !== "for_review" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              Generated Documents
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="outline"
                onClick={() => handleDownloadDocument("disclosure")}
                disabled={docLoading !== null}
              >
                <Download className="mr-2 h-4 w-4" />
                {docLoading === "disclosure" ? "Loading..." : "Disclosure Statement"}
              </Button>
              <Button
                variant="outline"
                onClick={() => handleDownloadDocument("promissory-note")}
                disabled={docLoading !== null}
              >
                <Download className="mr-2 h-4 w-4" />
                {docLoading === "promissory-note" ? "Loading..." : "Promissory Note"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Attached documents — available for every loan, including drafts so
          the policy exception letter is reachable from the very first save. */}
      <LoanDocumentsCard loanId={loan.id} />

      {/* Repayments — only for released+ loans */}
      {isLocked && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                Repayments
              </CardTitle>
              {["released", "ongoing"].includes(loan.status) && (
                <Button
                  size="sm"
                  className="bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark"
                  onClick={() => setRecordPaymentOpen(true)}
                >
                  <Plus className="mr-1 h-3 w-3" />
                  Record Payment
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {repaymentsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Spinner className="size-5 text-muted-foreground" />
              </div>
            ) : repayments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No repayments recorded yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Remarks</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-20" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {repayments.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>{formatDate(r.payment_date)}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(r.amount_paid)}</TableCell>
                        <TableCell className="text-muted-foreground">{r.remarks ?? "—"}</TableCell>
                        <TableCell>
                          <Badge variant={r.status === "voided" ? "destructive" : "default"} className="text-xs">
                            {r.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {r.status !== "voided" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:text-red-700 text-xs"
                              onClick={() => handleVoidRepayment(r.id)}
                              disabled={actionLoading}
                            >
                              Void
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Loan Adjustments — only for released+ loans */}
      {isLocked && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Settings2 className="h-4 w-4 text-muted-foreground" />
                Loan Adjustments
              </CardTitle>
              {["released", "ongoing"].includes(loan.status) && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setCreateAdjustmentOpen(true)}
                >
                  <Plus className="mr-1 h-3 w-3" />
                  New Adjustment
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {adjustmentsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Spinner className="size-5 text-muted-foreground" />
              </div>
            ) : adjustments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No adjustments.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="w-32" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {adjustments.map((adj) => (
                      <TableRow key={adj.id}>
                        <TableCell className="capitalize text-sm">{adj.adjustment_type.replace(/_/g, " ")}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{adj.description ?? "—"}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              adj.status === "approved" ? "default" :
                              adj.status === "rejected" ? "destructive" :
                              adj.status === "applied" ? "secondary" :
                              "outline"
                            }
                            className="text-xs"
                          >
                            {adj.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{formatDate(adj.created_at)}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {adj.status === "pending" && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-green-600 hover:text-green-700 text-xs"
                                  onClick={() => handleAdjustmentAction(adj.id, "approve")}
                                  disabled={actionLoading}
                                >
                                  Approve
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-600 hover:text-red-700 text-xs"
                                  onClick={() => handleAdjustmentAction(adj.id, "reject")}
                                  disabled={actionLoading}
                                >
                                  Reject
                                </Button>
                              </>
                            )}
                            {adj.status === "approved" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-brand-orange hover:text-brand-orange-dark text-xs"
                                onClick={() => handleAdjustmentAction(adj.id, "apply")}
                                disabled={actionLoading}
                              >
                                Apply
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Dialogs ── */}

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

      {/* Edit Loan Application Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Loan Application</DialogTitle>
            <DialogDescription>
              Update the draft for{" "}
              <span className="font-medium">{loanBorrowerName}</span>. Changes
              are saved immediately and the loan will keep its current workflow
              state.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="edit-principal">Principal Amount</Label>
                <Input
                  id="edit-principal"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={editForm.principal_amount}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, principal_amount: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-rate">Interest Rate (%)</Label>
                <Input
                  id="edit-rate"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={editForm.interest_rate}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, interest_rate: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-start-date">Start Date</Label>
                <Input
                  id="edit-start-date"
                  type="date"
                  value={editForm.start_date}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, start_date: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-scb">SCB Amount</Label>
                <Input
                  id="edit-scb"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={editForm.scb_amount}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, scb_amount: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-purpose">Purpose</Label>
              <Textarea
                id="edit-purpose"
                placeholder="What is this loan for?"
                value={editForm.purpose}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, purpose: e.target.value }))
                }
                className="min-h-[80px]"
              />
            </div>
            {approvalRounds.length > 0 && (
              <div className="rounded-md border border-amber-300/50 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-700/40 dark:bg-amber-900/10 dark:text-amber-200">
                This loan was sent back for revision. Update the fields above
                and then use <span className="font-semibold">Submit for Review</span>{" "}
                to restart the approval chain.
              </div>
            )}
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => setEditOpen(false)}
              disabled={editSaving}
            >
              Cancel
            </Button>
            <Button
              className="bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark"
              onClick={handleSaveEdit}
              disabled={editSaving}
            >
              {editSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Submit for Review Dialog */}
      <Dialog open={submitOpen} onOpenChange={setSubmitOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit for Review</DialogTitle>
            <DialogDescription>
              Are you sure you want to submit this loan application for review?
              Once submitted, it will be queued for approval.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setSubmitOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark"
              onClick={handleSubmitForReview}
            >
              <Send className="mr-2 h-4 w-4" />
              Submit
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Approve Dialog */}
      <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Loan Application</DialogTitle>
            <DialogDescription>
              You are about to approve{" "}
              <span className="font-medium">{loan.application_number}</span> for{" "}
              <span className="font-medium">{loanBorrowerName}</span>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div>
              <Label htmlFor="approval-remarks">Remarks (optional)</Label>
              <Textarea
                id="approval-remarks"
                placeholder="Add any notes about this approval..."
                value={approvalRemarks}
                onChange={(e) => setApprovalRemarks(e.target.value)}
                className="mt-1.5"
              />
            </div>
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setApproveOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-green-600 text-white hover:bg-green-700"
              onClick={handleApprove}
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Approve
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Loan Application</DialogTitle>
            <DialogDescription>
              You are about to reject{" "}
              <span className="font-medium">{loan.application_number}</span> for{" "}
              <span className="font-medium">{loanBorrowerName}</span>. Please
              provide a reason.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div>
              <Label htmlFor="rejection-remarks">
                Reason for Rejection{" "}
                <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="rejection-remarks"
                placeholder="Explain why this application is being rejected..."
                value={rejectionRemarks}
                onChange={(e) => setRejectionRemarks(e.target.value)}
                className="mt-1.5"
                required
              />
            </div>
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setRejectOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={!rejectionRemarks.trim()}
            >
              <XCircle className="mr-2 h-4 w-4" />
              Reject
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
                    {loan.net_proceeds != null ? formatCurrency(loan.net_proceeds) : "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Interest Rate / Type</p>
                  <p className="text-sm font-medium">
                    {loan.interest_rate}% / <span className="capitalize">{loanInterestType || "N/A"}</span>
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Term / Frequency</p>
                  <p className="text-sm font-medium">
                    {loanTerm} months / {PAYMENT_FREQUENCY_LABELS[loanFrequency as keyof typeof PAYMENT_FREQUENCY_LABELS] ?? loanFrequency}
                  </p>
                </div>
              </div>
            </div>

            {/* Co-Makers Section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>
                  Co-Maker
                  {(loan.co_makers?.length ?? 0) !== 1 ? "s" : ""}
                  {(loan.co_makers?.length ?? 0) > 0 && (
                    <span className="ml-1 text-xs text-muted-foreground font-normal">
                      ({loan.co_makers!.length})
                    </span>
                  )}
                </Label>
                {!addCoMakerOpen && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1 text-xs"
                    onClick={() => setAddCoMakerOpen(true)}
                  >
                    <Plus className="h-3 w-3" />
                    Add Co-Maker
                  </Button>
                )}
              </div>
              <div className="rounded-lg border bg-muted/50 p-3 space-y-2">
                {(loan.co_makers?.length ?? 0) === 0 ? (
                  <p className="text-sm text-muted-foreground italic">
                    No co-maker on file
                  </p>
                ) : (
                  loan.co_makers!.map((cm, idx) => {
                    const name =
                      cm.full_name ??
                      cm.name ??
                      [cm.first_name, cm.middle_name, cm.last_name, cm.suffix]
                        .filter(Boolean)
                        .join(" ");
                    return (
                      <div
                        key={cm.id ?? idx}
                        className="flex items-start justify-between gap-3 text-sm"
                      >
                        <div className="min-w-0">
                          <p className="font-medium truncate">{name || "—"}</p>
                          {cm.relationship && (
                            <p className="text-xs text-muted-foreground">
                              {cm.relationship}
                            </p>
                          )}
                        </div>
                        <Badge variant="outline" className="text-xs shrink-0">
                          Co-Maker {idx + 1}
                        </Badge>
                      </div>
                    );
                  })
                )}
              </div>
              {addCoMakerOpen && (
                <div className="rounded-lg border border-brand-orange/30 bg-brand-orange/5 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">Add Co-Maker</p>
                    <button
                      type="button"
                      onClick={() => setAddCoMakerOpen(false)}
                      className="text-muted-foreground hover:text-foreground"
                      aria-label="Close"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="new-cm-first" className="text-xs">
                        First Name <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="new-cm-first"
                        className="h-9"
                        value={newCoMaker.first_name}
                        onChange={(e) =>
                          setNewCoMaker((prev) => ({
                            ...prev,
                            first_name: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="new-cm-last" className="text-xs">
                        Last Name <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="new-cm-last"
                        className="h-9"
                        value={newCoMaker.last_name}
                        onChange={(e) =>
                          setNewCoMaker((prev) => ({
                            ...prev,
                            last_name: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="new-cm-contact" className="text-xs">
                        Contact Number
                      </Label>
                      <Input
                        id="new-cm-contact"
                        type="tel"
                        className="h-9"
                        placeholder="09171234567"
                        value={newCoMaker.contact_number}
                        onChange={(e) =>
                          setNewCoMaker((prev) => ({
                            ...prev,
                            contact_number: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="new-cm-rel" className="text-xs">
                        Relationship to Member
                      </Label>
                      <Input
                        id="new-cm-rel"
                        className="h-9"
                        placeholder="e.g. Sibling, Spouse"
                        value={newCoMaker.relationship_to_borrower}
                        onChange={(e) =>
                          setNewCoMaker((prev) => ({
                            ...prev,
                            relationship_to_borrower: e.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => setAddCoMakerOpen(false)}
                      disabled={addingCoMaker}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 text-xs bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark"
                      onClick={handleAddSecondCoMaker}
                      disabled={
                        addingCoMaker ||
                        !newCoMaker.first_name.trim() ||
                        !newCoMaker.last_name.trim()
                      }
                    >
                      {addingCoMaker ? "Adding..." : "Add Co-Maker"}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Release Date Picker */}
            <div className="space-y-1.5">
              <Label>Release Date</Label>
              <Popover open={releaseDatePickerOpen} onOpenChange={setReleaseDatePickerOpen}>
                <PopoverTrigger
                  render={
                    <button
                      type="button"
                      className="flex h-9 w-full items-center gap-2 rounded-lg border border-input bg-transparent px-3 text-sm transition-colors hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                    />
                  }
                >
                  <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                  <span>{formatDateObj(releaseDate)}</span>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={releaseDate}
                    onSelect={(date) => {
                      if (date) setReleaseDate(date);
                      setReleaseDatePickerOpen(false);
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Computed dates */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Maturity Date</p>
                <p className="text-sm font-medium">
                  {computedMaturityDate ? formatDateObj(computedMaturityDate) : "N/A"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">First Due Date</p>
                <p className="text-sm font-medium">
                  {releaseSchedule.length > 0 ? formatDateObj(releaseSchedule[0].dueDate) : "N/A"}
                </p>
              </div>
            </div>

            {/* Amortization Preview */}
            {releaseSchedule.length > 0 && (
              <div className="space-y-2">
                <Label>Amortization Schedule Preview</Label>
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
                      {releaseSchedule.map((row) => (
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
              </div>
            )}

            {/* Warning */}
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-sm text-amber-700">
                Releasing this loan will lock the principal, interest rate, and term.
                The borrower will receive{" "}
                <span className="font-semibold">
                  {loan.net_proceeds != null ? formatCurrency(loan.net_proceeds) : formatCurrency(loan.principal_amount)}
                </span>{" "}
                as net proceeds.
              </p>
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setReleaseOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark"
              onClick={handleRelease}
            >
              <Unlock className="mr-2 h-4 w-4" />
              Confirm Release
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Record Payment Dialog */}
      <Dialog open={recordPaymentOpen} onOpenChange={setRecordPaymentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>
              Record a repayment for loan {loan.loan_account_number || loan.application_number}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Payment Date</Label>
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
            <div className="space-y-1.5">
              <Label htmlFor="payment-amount">Amount <span className="text-red-500">*</span></Label>
              <Input
                id="payment-amount"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="payment-remarks">Remarks (optional)</Label>
              <Textarea
                id="payment-remarks"
                placeholder="Add notes about this payment..."
                value={paymentRemarks}
                onChange={(e) => setPaymentRemarks(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setRecordPaymentOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark"
              onClick={handleRecordPayment}
              disabled={actionLoading || !paymentAmount || Number(paymentAmount) <= 0}
            >
              <DollarSign className="mr-2 h-4 w-4" />
              Record Payment
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
              <Select value={adjType} onValueChange={(v) => setAdjType(v as LoanAdjustmentType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="restructure">Restructure</SelectItem>
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
            {adjType === "restructure" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="adj-new-rate">New Interest Rate (%)</Label>
                    <Input
                      id="adj-new-rate"
                      type="number"
                      placeholder={String(loan.interest_rate ?? "")}
                      step="0.1"
                      value={adjNewInterestRate}
                      onChange={(e) => setAdjNewInterestRate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="adj-new-term">New Term (months)</Label>
                    <Input
                      id="adj-new-term"
                      type="number"
                      placeholder={String(loanTerm ?? "")}
                      value={adjNewTerm}
                      onChange={(e) => setAdjNewTerm(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>New Payment Frequency</Label>
                  <Select value={adjNewFrequency ?? null} onValueChange={(v) => setAdjNewFrequency(v)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Keep current frequency" />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_FREQUENCY_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            {adjType === "penalty_waiver" && (
              <div className="space-y-1.5">
                <Label htmlFor="adj-penalty">Penalty Amount to Waive <span className="text-red-500">*</span></Label>
                <Input
                  id="adj-penalty"
                  type="number"
                  placeholder="0.00"
                  step="0.01"
                  value={adjPenaltyAmount}
                  onChange={(e) => setAdjPenaltyAmount(e.target.value)}
                />
              </div>
            )}
            {adjType === "term_extension" && (
              <div className="space-y-1.5">
                <Label htmlFor="adj-extend-term">Additional Months <span className="text-red-500">*</span></Label>
                <Input
                  id="adj-extend-term"
                  type="number"
                  placeholder="e.g. 3"
                  value={adjNewTerm}
                  onChange={(e) => setAdjNewTerm(e.target.value)}
                />
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
    </div>
  );
}
