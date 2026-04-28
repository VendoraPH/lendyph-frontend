"use client";

import { useState, useMemo, useEffect, useCallback, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";
import {
  loanService,
  loanAdjustmentService,
  loanDocumentService,
  repaymentService,
  coMakerService,
  reportService,
} from "@/services";
import type { RepaymentPreview } from "@/services/repayment.service";
import { useAuthStore } from "@/store/auth-store";
import { generateDisclosureHTML, generatePromissoryNoteHTML } from "@/lib/loan-document-templates";
import { LoanDocumentsCard } from "./_components/loan-documents-card";
import { ShareCapitalCard } from "./_components/share-capital-card";
import { BorrowerActiveLoans } from "./_components/borrower-active-loans";
import { WorkflowHistory } from "./_components/workflow-history";
import { StatementOfAccountDialog } from "./_components/dialogs/statement-of-account-dialog";
import { SubmitForReviewDialog } from "./_components/dialogs/submit-for-review-dialog";
import { ApproveDialog } from "./_components/dialogs/approve-dialog";
import { RejectDialog } from "./_components/dialogs/reject-dialog";
import { ReleaseDialog } from "./_components/dialogs/release-dialog";
import { RecordPaymentDialog } from "./_components/dialogs/record-payment-dialog";
import { CreateAdjustmentDialog } from "./_components/dialogs/create-adjustment-dialog";
import { LoanInformationCard } from "./_components/loan-information-card";
import { MemberCoMakerCard } from "./_components/member-co-maker-card";
import { ReleaseDetailsCard } from "./_components/release-details-card";
import { AmortizationScheduleCard } from "./_components/amortization-schedule-card";
import { LedgerCard } from "./_components/ledger-card";
import { ApprovalProcessCard } from "./_components/approval-process-card";
import { useUsers } from "./_hooks/use-users";
import { useLoanRepayments } from "./_hooks/use-loan-repayments";
import { useLoanAdjustments } from "./_hooks/use-loan-adjustments";
import { useApprovalChainConfig } from "./_hooks/use-approval-chain-config";
import type { LoanSchedule } from "@/types/loan";
import type { LoanAdjustmentType } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Clock,
  FileText,
  Ban,
  AlertCircle,
  Download,
  ChevronDown,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LOAN_STATUS_LABELS } from "@/constants";
import type { Loan } from "@/types/loan";
import {
  formatDateTime,
  formatDateISO,
} from "@/lib/format";
import {
  addMonths,
  generateSchedule,
} from "./_lib/schedule";
import type {
  ApprovalStep,
  ApprovalStepStatus,
  RevisionRound,
} from "./_lib/approval-types";
import {
  canUserActOnStep,
  loadApprovalState,
  saveApprovalState,
  deriveStepsFromLoanStatus,
} from "./_lib/approval";

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

export default function LoanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const loanId = Number(id);
  const router = useRouter();

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
  const [scheduleOpen, setScheduleOpen] = useState(false);

  // Repayments state
  const [recordPaymentOpen, setRecordPaymentOpen] = useState(false);
  const [paymentDate, setPaymentDate] = useState<Date>(new Date());
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentRemarks, setPaymentRemarks] = useState("");
  const [paymentDatePickerOpen, setPaymentDatePickerOpen] = useState(false);
  const [paymentPreview, setPaymentPreview] = useState<RepaymentPreview | null>(null);
  const [paymentPreviewLoading, setPaymentPreviewLoading] = useState(false);
  const [paymentMode, setPaymentMode] = useState<"regular" | "advance">("regular");
  const [advancePeriods, setAdvancePeriods] = useState<number>(1);

  // Loan Adjustments state
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
  const users = useUsers();
  const [aoEditing, setAoEditing] = useState(false);
  const [aoOpen, setAoOpen] = useState(false);
  const [aoSaving, setAoSaving] = useState(false);

  // Repayments + adjustments fetched via dedicated hooks
  const {
    repayments,
    loading: repaymentsLoading,
    refetch: fetchRepayments,
    setRepayments,
  } = useLoanRepayments(loan?.id, loan?.status);
  const {
    adjustments,
    loading: adjustmentsLoading,
    refetch: fetchAdjustments,
  } = useLoanAdjustments(loan?.id, loan?.status);

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

  // Borrower's other active loans — shown during approval so officers can
  // see the borrower's existing obligations before approving.
  const [borrowerLoans, setBorrowerLoans] = useState<Loan[]>([]);
  const [borrowerLoansLoading, setBorrowerLoansLoading] = useState(false);
  // Chain configuration fetched from the approval-workflow service
  const chainConfig = useApprovalChainConfig(loan?.id, loan?.policy_exception);

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
    const scb = loan.scb_amount ?? 0;
    const isReleased = ["released", "ongoing", "completed", "defaulted", "restructured", "closed"].includes(loan.status);
    const isPreRelease = ["draft", "for_review", "approved"].includes(loan.status);

    if (isReleased) {
      const relDate = loan.released_at ?? loan.start_date ?? loan.release_date;
      if (!relDate) return [];
      const freq = loan.frequency ?? loan.payment_frequency ?? "monthly";
      const isUponMaturity = freq === "upon_maturity" || loan.interest_method === "upon_maturity" || loan.interest_type === "upon_maturity";
      // Use API schedule if available, map to display format
      if (apiSchedule && apiSchedule.length > 0) {
        if (isUponMaturity) {
          // Backend may return one row per period; collapse everything into a single maturity payment
          const lastRow = apiSchedule[apiSchedule.length - 1];
          const totalPrincipal = apiSchedule.reduce((s, r) => s + (parseFloat(String(r.principal)) || 0), 0);
          const totalInterest = apiSchedule.reduce((s, r) => s + (parseFloat(String(r.interest)) || 0), 0);
          const totalAmountDue = apiSchedule.reduce((s, r) => s + (parseFloat(String(r.amount_due)) || 0), 0);
          const totalAmountPaid = apiSchedule.reduce((s, r) => s + (parseFloat(String(r.amount_paid)) || 0), 0);
          const totalScb = scb * apiSchedule.length;
          return [{
            period: 1,
            dueDate: new Date(lastRow.due_date),
            principal: totalPrincipal,
            interest: totalInterest,
            shareCapitalBuildUp: totalScb,
            totalPayment: totalAmountDue + totalScb,
            balance: parseFloat(String(lastRow.balance)) || 0,
            status: lastRow.status,
            amountPaid: totalAmountPaid,
          }];
        }
        return apiSchedule.map((row, idx) => ({
          period: idx + 1,
          dueDate: new Date(row.due_date),
          principal: parseFloat(String(row.principal)) || 0,
          interest: parseFloat(String(row.interest)) || 0,
          shareCapitalBuildUp: scb,
          totalPayment: (parseFloat(String(row.amount_due)) || 0) + scb,
          balance: parseFloat(String(row.balance)) || 0,
          status: row.status,
          amountPaid: parseFloat(String(row.amount_paid)) || 0,
        }));
      }
      // Fallback to client-side generation
      const termVal = loan.term ?? loan.term_months ?? 0;
      const freqVal = freq as Parameters<typeof generateSchedule>[3];
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
    }

    if (isPreRelease) {
      // Prefer server-computed preview schedule
      if (previewSchedule && previewSchedule.length > 0) {
        return previewSchedule.map((row, idx) => ({
          period: idx + 1,
          dueDate: new Date(row.due_date),
          principal: parseFloat(String(row.principal)) || 0,
          interest: parseFloat(String(row.interest)) || 0,
          shareCapitalBuildUp: scb,
          totalPayment: (parseFloat(String(row.amount_due)) || 0) + scb,
          balance: parseFloat(String(row.balance)) || 0,
          status: row.status,
          amountPaid: parseFloat(String(row.amount_paid)) || 0,
        }));
      }
      // Fallback: client-side generation using today as the start date
      const termVal = loan.term ?? loan.term_months ?? 0;
      if (!termVal || !loan.principal_amount || !loan.interest_rate) return [];
      const freqVal = (loan.frequency ?? loan.payment_frequency ?? "monthly") as Parameters<typeof generateSchedule>[3];
      const methodVal = (loan.interest_method ?? loan.interest_type ?? "fixed") as Parameters<typeof generateSchedule>[4];
      const startDate = loan.start_date ? new Date(loan.start_date) : new Date();
      return generateSchedule(
        loan.principal_amount,
        loan.interest_rate,
        termVal,
        freqVal,
        methodVal,
        startDate,
        scb,
      );
    }

    return [];
  }, [loan?.principal_amount, loan?.interest_rate, loan?.term, loan?.term_months, loan?.frequency, loan?.payment_frequency, loan?.interest_method, loan?.interest_type, loan?.scb_amount, loan?.released_at, loan?.start_date, loan?.release_date, loan?.status, apiSchedule, previewSchedule]);

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

  // Remaining-due totals for the Schedule tab footer — excludes fully-paid periods.
  const scheduleRemainingTotals = useMemo(() => {
    return storedSchedule.reduce(
      (acc, row) => {
        if (row.status === "paid") return acc;
        return {
          principal: acc.principal + row.principal,
          interest: acc.interest + row.interest,
          shareCapitalBuildUp: acc.shareCapitalBuildUp + row.shareCapitalBuildUp,
          totalPayment: acc.totalPayment + row.totalPayment,
        };
      },
      { principal: 0, interest: 0, shareCapitalBuildUp: 0, totalPayment: 0 },
    );
  }, [storedSchedule]);

  // Opening running-balance per period: how much Principal / Interest / SCB
  // is still owed at the START of period N (before that period's payment).
  // First row shows the full original obligation; last row shows what the
  // final payment will settle; after the term everything reaches zero.
  const balancesRows = useMemo(() => {
    if (storedSchedule.length === 0) return [];
    let remainingPrincipal = storedScheduleTotals.principal;
    let remainingInterest = storedScheduleTotals.interest;
    let remainingScb = storedScheduleTotals.shareCapitalBuildUp;
    return storedSchedule.map((row) => {
      const opening = {
        principal: remainingPrincipal,
        interest: remainingInterest,
        scb: remainingScb,
        total: remainingPrincipal + remainingInterest + remainingScb,
      };
      remainingPrincipal = Math.max(0, remainingPrincipal - row.principal);
      remainingInterest = Math.max(0, remainingInterest - row.interest);
      remainingScb = Math.max(0, remainingScb - row.shareCapitalBuildUp);
      return { ...row, opening };
    });
  }, [storedSchedule, storedScheduleTotals.principal, storedScheduleTotals.interest, storedScheduleTotals.shareCapitalBuildUp]);

  // Ledger rows: repayments sorted by date with running principal/interest/scb balances.
  const ledgerRows = useMemo(() => {
    const principalStart = loan?.principal_amount ?? 0;
    const interestStart = storedScheduleTotals.interest;
    const scbStart = storedScheduleTotals.shareCapitalBuildUp;
    const sorted = [...repayments].sort(
      (a, b) => new Date(a.payment_date).getTime() - new Date(b.payment_date).getTime(),
    );
    let principalBal = principalStart;
    let interestBal = interestStart;
    let scbBal = scbStart;
    return sorted.map((r) => {
      principalBal = Math.max(0, principalBal - (r.principal_paid ?? 0));
      interestBal = Math.max(0, interestBal - (r.interest_paid ?? 0));
      scbBal = Math.max(0, scbBal - (r.scb_paid ?? 0));
      return { ...r, principalBal, interestBal, scbBal };
    });
  }, [repayments, loan?.principal_amount, storedScheduleTotals.interest, storedScheduleTotals.shareCapitalBuildUp]);

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
  const loanApprovedBy = loan?.approved_by_user?.full_name ?? loan?.approved_by_user?.name ?? loan?.approved_by;
  const loanReleasedBy = loan?.released_by_user?.full_name ?? loan?.released_by_user?.name ?? loan?.released_by;
  const loanRejectedBy = loan?.created_by_user?.full_name ?? loan?.rejected_by; // TODO: actual rejected_by_user
  // total_payable from API is computed by summing amortization_schedules. For
  // unreleased loans (draft/for_review/approved) those rows don't exist yet,
  // so the API returns 0. Fall back to a straight-line projection — same math
  // the loan-creation form uses for its preview — so the value matches what
  // the user expected when they filled out the form.
  const expectedInterest =
    Number(loan?.principal_amount ?? 0) * (Number(loan?.interest_rate ?? 0) / 100) * Number(loan?.term ?? 0);
  const loanTotalPayable =
    Number(loan?.total_payable ?? 0) > 0
      ? Number(loan!.total_payable)
      : storedSchedule.length > 0
        ? storedSchedule.reduce((sum, r) => sum + r.totalPayment, 0)
        : Number(loan?.principal_amount ?? 0) + expectedInterest;

  // Live-preview the repayment allocation as the user types the amount.
  // Mirrors the rich breakdown shown on /payments so cashiers see exactly
  // which schedule periods, principal/interest/penalty/SCB this payment will
  // settle before posting. Must sit ABOVE the early returns below to keep
  // hook order stable across renders.
  useEffect(() => {
    if (!recordPaymentOpen || !loan) {
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
  }, [recordPaymentOpen, loan, paymentAmount, paymentDate]);

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
  // is still a draft OR has been sent back by an approver. The button links
  // to /loans/new?edit={id} so the full New Loan form is used for editing.
  const canEditLoanApplication =
    !!loan &&
    !isLocked &&
    loan.status !== "rejected" &&
    !!currentStep &&
    currentStep.kind === "submit" &&
    canActOnCurrentStep;

  // Step 0 (Loan Processor): Submit the draft for review.
  // First submission (draft → for_review) goes through loanService.submit().
  // Resubmissions after a send-back are a local-only chain reset — the loan's
  // server status is already for_review (send-back has no backend endpoint),
  // so calling submit again would 422. Gate the API call on loan.status.
  const handleStepSubmit = async () => {
    if (!loan || !currentStep || currentStep.kind !== "submit") return;
    if (!canActOnCurrentStep) {
      toast.error(`Only a user with the ${currentStep.role} role can submit the draft`);
      return;
    }
    try {
      setStepActionLoading(true);
      if (loan.status === "draft") {
        const updatedLoan = await loanService.submit(loan.id);
        setLoan(updatedLoan);
      }
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
      const repayment = await repaymentService.create(loan.id, {
        payment_date: formatDateISO(paymentDate),
        amount_paid: Number(paymentAmount),
        remarks: composedRemarks,
      });
      toast.success(
        paymentMode === "advance" ? "Advance payment recorded" : "Payment recorded"
      );
      setRecordPaymentOpen(false);
      setPaymentAmount("");
      setPaymentRemarks("");
      setPaymentDate(new Date());
      setPaymentPreview(null);
      setPaymentMode("regular");
      setAdvancePeriods(1);
      router.push(`/payments/${repayment.id}`);
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
      // Backend returns `deductions` as an array of {name, amount, type}.
      const deductionsArr = (Array.isArray(raw.deductions) ? raw.deductions : []) as Array<Record<string, unknown>>;
      const findFee = (name: string): number => {
        const m = deductionsArr.find((d) => String(d?.name ?? "").toLowerCase() === name.toLowerCase());
        return m ? parseFloat(String(m.amount ?? 0)) : 0;
      };
      const processingFee = findFee("Processing Fee");
      const serviceFee = findFee("Service Fee");
      const notarialFee = findFee("Notarial Fee");
      const otherDeductions = Math.max(0, totalDeductionsVal - processingFee - serviceFee - notarialFee);
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

      <ApprovalProcessCard
        loan={loan}
        steps={approvalSteps}
        rounds={approvalRounds}
        currentStep={currentStep}
        allStepsApproved={allStepsApproved}
        canActOnCurrentStep={canActOnCurrentStep}
        isConfirmationStep={isConfirmationStep}
        currentUser={currentUser}
        currentUserDisplayName={currentUserDisplayName}
        canEditLoanApplication={canEditLoanApplication}
        stepRemarks={stepRemarks}
        onStepRemarksChange={setStepRemarks}
        stepActionLoading={stepActionLoading}
        actionLoading={actionLoading}
        sendBackTargets={sendBackTargets}
        sendBackTargetIndex={sendBackTargetIndex}
        onSendBackTargetIndexChange={setSendBackTargetIndex}
        onStepSubmit={handleStepSubmit}
        onStepApprove={handleStepApprove}
        onStepSendBack={handleStepSendBack}
        onStepRelease={handleStepRelease}
        onVoidLoan={handleVoidLoan}
      />

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
        <LoanInformationCard
          loan={loan}
          productName={loanProductName}
          interestType={loanInterestType}
          term={loanTerm}
          frequency={loanFrequency}
          totalPayable={loanTotalPayable}
          processingFee={loanProcessingFee}
          serviceFee={loanServiceFee}
          otherDeductions={loanOtherDeductions}
          totalDeductions={totalDeductions}
          isLocked={isLocked}
        />

        {/* Card 2: Borrower's Active Loans */}
        <BorrowerActiveLoans
          loans={borrowerLoans}
          loading={borrowerLoansLoading}
          approvalSteps={approvalSteps}
          loanStatus={loan.status}
          loan={loan}
        />

        {/* Card 3: Member & Co-Maker */}
        <MemberCoMakerCard
          loan={loan}
          borrowerName={loanBorrowerName}
          coMakerName={loanCoMakerName}
          users={users}
          aoEditing={aoEditing}
          onAoEditingChange={setAoEditing}
          aoOpen={aoOpen}
          onAoOpenChange={setAoOpen}
          aoSaving={aoSaving}
          onSaveAo={handleSaveAO}
        />

        {/* Share Capital — current balance for the loan's member */}
        <ShareCapitalCard borrowerId={loan.borrower?.id ?? loan.borrower_id ?? null} />

        {/* Card 4: Workflow History */}
        <Collapsible defaultOpen={false}>
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
        <ReleaseDetailsCard
          loan={loan}
          summary={loanSummary}
          onOpenStatementOfAccount={handleOpenStatementOfAccount}
        />
      )}

      {/* Amortization Schedule — collapsible, collapsed by default */}
      {storedSchedule.length > 0 && (
        <AmortizationScheduleCard
          loan={loan}
          schedule={storedSchedule}
          totals={storedScheduleTotals}
          open={scheduleOpen}
          onOpenChange={setScheduleOpen}
        />
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

      {/* Ledger — only for released+ loans */}
      {isLocked && (
        <LedgerCard
          loan={loan}
          rows={ledgerRows}
          loanReleaseDate={loanReleaseDate}
          loading={repaymentsLoading}
          scheduleTotals={storedScheduleTotals}
          actionLoading={actionLoading}
          onCreateAdjustment={() => setCreateAdjustmentOpen(true)}
          onRecordPayment={() => setRecordPaymentOpen(true)}
          onVoidRepayment={handleVoidRepayment}
        />
      )}

      {/* ── Dialogs ── */}

      <StatementOfAccountDialog
        open={soaOpen}
        onOpenChange={setSoaOpen}
        applicationNumber={loan.application_number ?? ""}
        loading={soaLoading}
        data={soaData}
      />

      <SubmitForReviewDialog
        open={submitOpen}
        onOpenChange={setSubmitOpen}
        onSubmit={handleSubmitForReview}
      />

      <ApproveDialog
        open={approveOpen}
        onOpenChange={setApproveOpen}
        applicationNumber={loan.application_number ?? ""}
        borrowerName={loanBorrowerName}
        remarks={approvalRemarks}
        onRemarksChange={setApprovalRemarks}
        onApprove={handleApprove}
      />

      <RejectDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        applicationNumber={loan.application_number ?? ""}
        borrowerName={loanBorrowerName}
        remarks={rejectionRemarks}
        onRemarksChange={setRejectionRemarks}
        onReject={handleReject}
      />

      <ReleaseDialog
        open={releaseOpen}
        onOpenChange={setReleaseOpen}
        loan={loan}
        borrowerName={loanBorrowerName}
        productName={loanProductName}
        interestType={loanInterestType}
        term={loanTerm}
        frequency={loanFrequency}
        releaseDate={releaseDate}
        onReleaseDateChange={setReleaseDate}
        releaseDatePickerOpen={releaseDatePickerOpen}
        onReleaseDatePickerOpenChange={setReleaseDatePickerOpen}
        releaseSchedule={releaseSchedule}
        scheduleTotals={scheduleTotals}
        computedMaturityDate={computedMaturityDate}
        addCoMakerOpen={addCoMakerOpen}
        onAddCoMakerOpenChange={setAddCoMakerOpen}
        newCoMaker={newCoMaker}
        onNewCoMakerChange={setNewCoMaker}
        addingCoMaker={addingCoMaker}
        onAddCoMaker={handleAddSecondCoMaker}
        onConfirm={handleRelease}
      />

      <RecordPaymentDialog
        open={recordPaymentOpen}
        onOpenChange={setRecordPaymentOpen}
        loan={loan}
        loanSummary={loanSummary}
        schedule={storedSchedule}
        scheduleTotals={storedScheduleTotals}
        preview={paymentPreview}
        previewLoading={paymentPreviewLoading}
        paymentDate={paymentDate}
        onPaymentDateChange={setPaymentDate}
        paymentDatePickerOpen={paymentDatePickerOpen}
        onPaymentDatePickerOpenChange={setPaymentDatePickerOpen}
        paymentAmount={paymentAmount}
        onPaymentAmountChange={setPaymentAmount}
        paymentRemarks={paymentRemarks}
        onPaymentRemarksChange={setPaymentRemarks}
        paymentMode={paymentMode}
        onPaymentModeChange={setPaymentMode}
        advancePeriods={advancePeriods}
        onAdvancePeriodsChange={setAdvancePeriods}
        actionLoading={actionLoading}
        onSubmit={handleRecordPayment}
      />

      <CreateAdjustmentDialog
        open={createAdjustmentOpen}
        onOpenChange={setCreateAdjustmentOpen}
        loanRef={loan.loan_account_number || loan.application_number || ""}
        defaultInterestRate={loan.interest_rate}
        defaultTermMonths={loanTerm}
        actionLoading={actionLoading}
        type={adjType}
        onTypeChange={setAdjType}
        description={adjDescription}
        onDescriptionChange={setAdjDescription}
        newBalance={adjNewBalance}
        onNewBalanceChange={setAdjNewBalance}
        newInterestRate={adjNewInterestRate}
        onNewInterestRateChange={setAdjNewInterestRate}
        newTerm={adjNewTerm}
        onNewTermChange={setAdjNewTerm}
        newFrequency={adjNewFrequency}
        onNewFrequencyChange={setAdjNewFrequency}
        penaltyAmount={adjPenaltyAmount}
        onPenaltyAmountChange={setAdjPenaltyAmount}
        remarks={adjRemarks}
        onRemarksChange={setAdjRemarks}
        onSubmit={handleCreateAdjustment}
      />
    </div>
  );
}
