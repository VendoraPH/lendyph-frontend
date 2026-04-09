"use client";

import { useState, useMemo, useEffect, useCallback, use } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";
import { loanService, loanAdjustmentService, repaymentService, coMakerService, userService } from "@/services";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { generateDisclosureHTML, generatePromissoryNoteHTML } from "@/lib/loan-document-templates";
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
  Circle,
  CheckCircle2,
  XCircle,
  AlertCircle,
  CalendarIcon,
  Download,
  Plus,
  DollarSign,
  Settings2,
  ChevronsUpDown,
  Pencil,
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
  }).format(parseFloat(String(amount ?? 0)) || 0);

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
): AmortizationRow[] {
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
      totalPayment: principalPerPeriod + interest,
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

// ── Workflow Steps ──

const WORKFLOW_STEPS: { status: LoanStatus; label: string }[] = [
  { status: "draft", label: "Draft" },
  { status: "for_review", label: "For Review" },
  { status: "approved", label: "Approved" },
  { status: "released", label: "Released" },
];

function getStepIndex(status: LoanStatus): number {
  const idx = WORKFLOW_STEPS.findIndex((s) => s.status === status);
  // For ongoing/completed/closed/defaulted/restructured, treat as released (last step)
  if (idx === -1) return WORKFLOW_STEPS.length - 1;
  return idx;
}

// ── Status Stepper Component ──

function StatusStepper({ loan }: { loan: Loan }) {
  const isRejected = loan.status === "rejected";
  const currentIndex = isRejected ? 1 : getStepIndex(loan.status);

  return (
    <div className="w-full">
      {/* Horizontal stepper for md+ */}
      <div className="hidden md:flex items-center justify-between">
        {WORKFLOW_STEPS.map((step, idx) => {
          const isCompleted = !isRejected && idx < currentIndex;
          const isCurrent = !isRejected && idx === currentIndex;
          const isRejectedStep = isRejected && idx === 1; // rejected at "For Review"
          const isPast = isRejected && idx === 0;

          return (
            <div key={step.status} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-1.5">
                {/* Circle */}
                <div
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-full border-2 transition-all",
                    isCompleted || isPast
                      ? "border-green-500 bg-green-500 text-white"
                      : isCurrent
                        ? "border-brand-orange bg-brand-orange text-white"
                        : isRejectedStep
                          ? "border-red-500 bg-red-500 text-white"
                          : "border-gray-300 bg-white text-gray-400 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-500"
                  )}
                >
                  {isCompleted || isPast ? (
                    <Check className="h-4 w-4" />
                  ) : isRejectedStep ? (
                    <X className="h-4 w-4" />
                  ) : isCurrent ? (
                    <Circle className="h-3 w-3 fill-current" />
                  ) : (
                    <Circle className="h-3 w-3" />
                  )}
                </div>
                {/* Label */}
                <span
                  className={cn(
                    "text-xs font-medium whitespace-nowrap",
                    isCompleted || isPast
                      ? "text-green-600"
                      : isCurrent
                        ? "text-brand-orange"
                        : isRejectedStep
                          ? "text-red-600"
                          : "text-gray-400"
                  )}
                >
                  {isRejectedStep ? "Rejected" : step.label}
                </span>
              </div>
              {/* Connecting line */}
              {idx < WORKFLOW_STEPS.length - 1 && (
                <div
                  className={cn(
                    "h-0.5 flex-1 mx-2 mt-[-1.25rem]",
                    !isRejected && idx < currentIndex
                      ? "bg-green-500"
                      : isRejected && idx === 0
                        ? "bg-red-500"
                        : "bg-gray-200"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Vertical stepper for mobile */}
      <div className="flex flex-col gap-0 md:hidden">
        {WORKFLOW_STEPS.map((step, idx) => {
          const isCompleted = !isRejected && idx < currentIndex;
          const isCurrent = !isRejected && idx === currentIndex;
          const isRejectedStep = isRejected && idx === 1;
          const isPast = isRejected && idx === 0;

          return (
            <div key={step.status} className="flex items-start gap-3">
              <div className="flex flex-col items-center">
                {/* Circle */}
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all",
                    isCompleted || isPast
                      ? "border-green-500 bg-green-500 text-white"
                      : isCurrent
                        ? "border-brand-orange bg-brand-orange text-white"
                        : isRejectedStep
                          ? "border-red-500 bg-red-500 text-white"
                          : "border-gray-300 bg-white text-gray-400 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-500"
                  )}
                >
                  {isCompleted || isPast ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : isRejectedStep ? (
                    <X className="h-3.5 w-3.5" />
                  ) : isCurrent ? (
                    <Circle className="h-2.5 w-2.5 fill-current" />
                  ) : (
                    <Circle className="h-2.5 w-2.5" />
                  )}
                </div>
                {/* Connecting line */}
                {idx < WORKFLOW_STEPS.length - 1 && (
                  <div
                    className={cn(
                      "w-0.5 h-6",
                      !isRejected && idx < currentIndex
                        ? "bg-green-500"
                        : isRejected && idx === 0
                          ? "bg-red-500"
                          : "bg-gray-200"
                    )}
                  />
                )}
              </div>
              {/* Label */}
              <span
                className={cn(
                  "text-sm font-medium pt-1",
                  isCompleted || isPast
                    ? "text-green-600"
                    : isCurrent
                      ? "text-brand-orange"
                      : isRejectedStep
                        ? "text-red-600"
                        : "text-gray-400"
                )}
              >
                {isRejectedStep ? "Rejected" : step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
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

  useEffect(() => {
    if (loan && ["released", "ongoing", "completed", "defaulted", "restructured", "closed"].includes(loan.status)) {
      fetchSchedule(loan.id);
    }
  }, [loan?.id, loan?.status, fetchSchedule]);

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
    );
  }, [loan?.principal_amount, loan?.interest_rate, loan?.term, loan?.term_months, loan?.frequency, loan?.payment_frequency, loan?.interest_method, loan?.interest_type, releaseDate]);

  const scheduleTotals = useMemo(() => {
    return releaseSchedule.reduce(
      (acc, row) => ({
        principal: acc.principal + row.principal,
        interest: acc.interest + row.interest,
        totalPayment: acc.totalPayment + row.totalPayment,
      }),
      { principal: 0, interest: 0, totalPayment: 0 },
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
    if (apiSchedule && apiSchedule.length > 0) {
      return apiSchedule.map((row, idx) => ({
        period: idx + 1,
        dueDate: new Date(row.due_date),
        principal: parseFloat(String(row.principal)) || 0,
        interest: parseFloat(String(row.interest)) || 0,
        totalPayment: parseFloat(String(row.amount_due)) || 0,
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
    );
  }, [loan?.principal_amount, loan?.interest_rate, loan?.term, loan?.term_months, loan?.frequency, loan?.payment_frequency, loan?.interest_method, loan?.interest_type, loan?.released_at, loan?.start_date, loan?.release_date, loan?.status, apiSchedule]);

  const storedScheduleTotals = useMemo(() => {
    return storedSchedule.reduce(
      (acc, row) => ({
        principal: acc.principal + row.principal,
        interest: acc.interest + row.interest,
        totalPayment: acc.totalPayment + row.totalPayment,
      }),
      { principal: 0, interest: 0, totalPayment: 0 },
    );
  }, [storedSchedule]);

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
    } catch {
      toast.error("Failed to release loan");
    } finally {
      setActionLoading(false);
    }
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

  // ── Loan Document Handlers ──

  const handleDownloadDocument = (type: "disclosure" | "promissory-note") => {
    try {
      setDocLoading(type);
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

      {/* Status Stepper */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Approval Workflow
          </CardTitle>
        </CardHeader>
        <CardContent>
          <StatusStepper loan={loan} />
        </CardContent>
      </Card>

      {/* Action Buttons */}
      {loan.status === "draft" && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                className="w-full sm:w-auto bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark"
                onClick={() => setSubmitOpen(true)}
              >
                <Send className="mr-2 h-4 w-4" />
                Submit for Review
              </Button>
              <Button
                variant="destructive"
                className="w-full sm:w-auto"
                disabled={actionLoading}
                onClick={handleVoidLoan}
              >
                <Ban className="mr-2 h-4 w-4" />
                Void Loan
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loan.status === "for_review" && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                className="w-full sm:w-auto bg-green-600 text-white hover:bg-green-700"
                onClick={() => setApproveOpen(true)}
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Approve
              </Button>
              <Button
                variant="destructive"
                className="w-full sm:w-auto"
                onClick={() => setRejectOpen(true)}
              >
                <XCircle className="mr-2 h-4 w-4" />
                Reject
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loan.status === "approved" && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                className="w-full sm:w-auto bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark"
                onClick={() => setReleaseOpen(true)}
              >
                <Unlock className="mr-2 h-4 w-4" />
                Release Loan
              </Button>
            </div>
          </CardContent>
        </Card>
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
          </CardContent>
        </Card>

        {/* Card 2: Deductions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Deductions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
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
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Unlock className="h-4 w-4 text-cyan-600" />
              Release Details
            </CardTitle>
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
              {loan.next_due_date && (
                <div>
                  <p className="text-xs text-muted-foreground">Next Due Date</p>
                  <p className="text-sm font-medium">{formatDate(loan.next_due_date)}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground">Outstanding Balance</p>
                <p className="text-sm font-semibold">{formatCurrency(loan.outstanding_balance ?? 0)}</p>
              </div>
            </div>
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
              Loan Documents
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
