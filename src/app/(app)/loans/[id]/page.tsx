"use client";

import { useState, useMemo, use } from "react";
import Link from "next/link";
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
import { Label } from "@/components/ui/label";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  LOAN_STATUS_LABELS,
  PAYMENT_FREQUENCY_LABELS,
} from "@/constants";
import type { Loan, LoanStatus } from "@/types/loan";

// ── Currency & Date Formatters ──

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(amount);

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

function generateLoanAccountNumber(loanId: number): string {
  const year = new Date().getFullYear();
  const seq = String(loanId).padStart(4, "0");
  return `LN-${year}${seq}`;
}

// ── Status Colors ──

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600 border-gray-200",
  for_review: "bg-amber-100 text-amber-700 border-amber-200",
  approved: "bg-blue-100 text-blue-700 border-blue-200",
  rejected: "bg-red-100 text-red-700 border-red-200",
  released: "bg-cyan-100 text-cyan-700 border-cyan-200",
  ongoing: "bg-green-100 text-green-700 border-green-200",
  completed: "bg-gray-100 text-gray-600 border-gray-200",
  defaulted: "bg-red-100 text-red-700 border-red-200",
  restructured: "bg-orange-100 text-orange-700 border-orange-200",
  closed: "bg-gray-200 text-gray-500 border-gray-300",
};

// ── Workflow Steps ──

const WORKFLOW_STEPS: { status: LoanStatus; label: string }[] = [
  { status: "draft", label: "Draft" },
  { status: "for_review", label: "For Review" },
  { status: "approved", label: "Approved" },
  { status: "released", label: "Released" },
  { status: "ongoing", label: "Ongoing" },
  { status: "completed", label: "Completed" },
];

function getStepIndex(status: LoanStatus): number {
  const idx = WORKFLOW_STEPS.findIndex((s) => s.status === status);
  // For closed/defaulted/restructured, treat as completed-level
  if (idx === -1) return WORKFLOW_STEPS.length - 1;
  return idx;
}

// ── Mock Data ──

const MOCK_LOANS: Loan[] = [
  {
    id: 1,
    application_number: "LA-20260001",
    borrower_id: 1,
    borrower_name: "Maria Santos",
    loan_product_name: "Salary Loan",
    principal_amount: 50000,
    interest_rate: 3,
    interest_type: "fixed",
    term_months: 12,
    payment_frequency: "monthly",
    processing_fee: 500,
    service_fee: 250,
    other_deductions: 0,
    net_proceeds: 49250,
    total_payable: 68000,
    outstanding_balance: 0,
    status: "draft",
    purpose: "Home renovation",
    created_at: "2026-03-28T09:15:00Z",
    updated_at: "2026-03-28T09:15:00Z",
  },
  {
    id: 2,
    application_number: "LA-20260002",
    borrower_id: 2,
    borrower_name: "Juan Dela Cruz",
    co_maker_name: "Pedro Santos",
    loan_product_name: "Business Loan",
    principal_amount: 150000,
    interest_rate: 2.5,
    interest_type: "diminishing",
    term_months: 24,
    payment_frequency: "monthly",
    processing_fee: 1500,
    service_fee: 750,
    other_deductions: 200,
    net_proceeds: 147550,
    total_payable: 195000,
    outstanding_balance: 0,
    status: "draft",
    purpose: "Sari-sari store expansion",
    created_at: "2026-03-27T14:30:00Z",
    updated_at: "2026-03-27T14:30:00Z",
  },
  {
    id: 3,
    application_number: "LA-20260003",
    borrower_id: 3,
    borrower_name: "Ana Reyes",
    loan_product_name: "Emergency Loan",
    principal_amount: 20000,
    interest_rate: 3.5,
    interest_type: "fixed",
    term_months: 6,
    payment_frequency: "bi_weekly",
    processing_fee: 200,
    service_fee: 100,
    net_proceeds: 19700,
    total_payable: 24200,
    outstanding_balance: 0,
    status: "for_review",
    purpose: "Medical expenses",
    created_at: "2026-03-25T10:00:00Z",
    updated_at: "2026-03-26T08:00:00Z",
  },
  {
    id: 4,
    application_number: "LA-20260004",
    borrower_id: 4,
    borrower_name: "Pedro Garcia",
    loan_product_name: "Salary Loan",
    principal_amount: 80000,
    interest_rate: 3,
    interest_type: "fixed",
    term_months: 18,
    payment_frequency: "monthly",
    processing_fee: 800,
    service_fee: 400,
    net_proceeds: 78800,
    total_payable: 123200,
    outstanding_balance: 0,
    status: "for_review",
    purpose: "Tuition fee",
    created_at: "2026-03-24T16:45:00Z",
    updated_at: "2026-03-25T09:30:00Z",
  },
  {
    id: 5,
    application_number: "LA-20260005",
    borrower_id: 5,
    borrower_name: "Rosa Mendoza",
    co_maker_name: "Elena Cruz",
    loan_product_name: "Business Loan",
    principal_amount: 200000,
    interest_rate: 2.5,
    interest_type: "diminishing",
    term_months: 36,
    payment_frequency: "monthly",
    processing_fee: 2000,
    service_fee: 1000,
    net_proceeds: 197000,
    total_payable: 290000,
    outstanding_balance: 0,
    status: "approved",
    purpose: "Bakery equipment purchase",
    approved_by: "Augustin Maputol",
    approved_at: "2026-03-23T11:00:00Z",
    approval_remarks: "Good credit history, approved for full amount",
    created_at: "2026-03-20T08:30:00Z",
    updated_at: "2026-03-23T11:00:00Z",
  },
  {
    id: 6,
    application_number: "LA-20260006",
    borrower_id: 6,
    borrower_name: "Carlo Ramos",
    loan_product_name: "Emergency Loan",
    principal_amount: 30000,
    interest_rate: 3.5,
    interest_type: "fixed",
    term_months: 6,
    payment_frequency: "weekly",
    processing_fee: 300,
    service_fee: 150,
    net_proceeds: 29550,
    total_payable: 36300,
    outstanding_balance: 0,
    status: "rejected",
    purpose: "Debt consolidation",
    rejected_by: "Augustin Maputol",
    rejected_at: "2026-03-22T14:00:00Z",
    rejection_remarks:
      "Existing loan still outstanding, exceeds debt-to-income ratio",
    created_at: "2026-03-19T13:00:00Z",
    updated_at: "2026-03-22T14:00:00Z",
  },
  {
    id: 7,
    application_number: "LA-20260007",
    loan_account_number: "LN-20260007",
    borrower_id: 7,
    borrower_name: "Elena Villanueva",
    loan_product_name: "Salary Loan",
    principal_amount: 100000,
    interest_rate: 3,
    interest_type: "fixed",
    term_months: 12,
    payment_frequency: "monthly",
    processing_fee: 1000,
    service_fee: 500,
    net_proceeds: 98500,
    total_payable: 136000,
    outstanding_balance: 102000,
    status: "released",
    purpose: "Home improvement",
    approved_by: "Augustin Maputol",
    approved_at: "2026-03-10T09:00:00Z",
    released_by: "Maria Santos",
    released_at: "2026-03-12T10:00:00Z",
    release_date: "2026-03-12",
    maturity_date: "2027-03-12",
    next_due_date: "2026-04-12",
    created_at: "2026-03-08T11:00:00Z",
    updated_at: "2026-03-12T10:00:00Z",
  },
  {
    id: 8,
    application_number: "LA-20260008",
    loan_account_number: "LN-20260008",
    borrower_id: 8,
    borrower_name: "Roberto Tan",
    co_maker_name: "Gloria Reyes",
    loan_product_name: "Business Loan",
    principal_amount: 300000,
    interest_rate: 2.5,
    interest_type: "diminishing",
    term_months: 24,
    payment_frequency: "monthly",
    processing_fee: 3000,
    service_fee: 1500,
    net_proceeds: 295500,
    total_payable: 390000,
    outstanding_balance: 325000,
    status: "ongoing",
    purpose: "Trucking business capital",
    approved_by: "Augustin Maputol",
    approved_at: "2026-02-15T09:00:00Z",
    released_by: "Maria Santos",
    released_at: "2026-02-18T14:00:00Z",
    release_date: "2026-02-18",
    maturity_date: "2028-02-18",
    next_due_date: "2026-04-18",
    created_at: "2026-02-10T08:00:00Z",
    updated_at: "2026-03-18T14:00:00Z",
  },
  {
    id: 9,
    application_number: "LA-20260009",
    loan_account_number: "LN-20260009",
    borrower_id: 9,
    borrower_name: "Lorna Bautista",
    loan_product_name: "Salary Loan",
    principal_amount: 40000,
    interest_rate: 3,
    interest_type: "fixed",
    term_months: 6,
    payment_frequency: "monthly",
    processing_fee: 400,
    service_fee: 200,
    net_proceeds: 39400,
    total_payable: 47200,
    outstanding_balance: 0,
    status: "completed",
    purpose: "Wedding expenses",
    approved_by: "Augustin Maputol",
    approved_at: "2025-09-05T10:00:00Z",
    released_by: "Maria Santos",
    released_at: "2025-09-08T09:00:00Z",
    release_date: "2025-09-08",
    maturity_date: "2026-03-08",
    created_at: "2025-09-01T07:30:00Z",
    updated_at: "2026-03-08T15:00:00Z",
  },
  {
    id: 10,
    application_number: "LA-20260010",
    loan_account_number: "LN-20260010",
    borrower_id: 10,
    borrower_name: "Dennis Aquino",
    loan_product_name: "Emergency Loan",
    principal_amount: 15000,
    interest_rate: 3.5,
    interest_type: "fixed",
    term_months: 3,
    payment_frequency: "weekly",
    processing_fee: 150,
    service_fee: 75,
    net_proceeds: 14775,
    total_payable: 16575,
    outstanding_balance: 0,
    status: "completed",
    purpose: "Appliance repair",
    approved_by: "Augustin Maputol",
    approved_at: "2025-12-10T11:00:00Z",
    released_by: "Maria Santos",
    released_at: "2025-12-12T09:00:00Z",
    release_date: "2025-12-12",
    maturity_date: "2026-03-12",
    created_at: "2025-12-08T14:00:00Z",
    updated_at: "2026-03-12T16:00:00Z",
  },
  {
    id: 11,
    application_number: "LA-20260011",
    loan_account_number: "LN-20260011",
    borrower_id: 11,
    borrower_name: "Gloria Pascual",
    loan_product_name: "Business Loan",
    principal_amount: 250000,
    interest_rate: 2.5,
    interest_type: "diminishing",
    term_months: 24,
    payment_frequency: "monthly",
    processing_fee: 2500,
    service_fee: 1250,
    net_proceeds: 246250,
    total_payable: 325000,
    outstanding_balance: 310000,
    status: "defaulted",
    purpose: "Restaurant startup",
    approved_by: "Augustin Maputol",
    approved_at: "2025-08-20T09:00:00Z",
    released_by: "Maria Santos",
    released_at: "2025-08-22T10:00:00Z",
    release_date: "2025-08-22",
    maturity_date: "2027-08-22",
    next_due_date: "2026-01-22",
    created_at: "2025-08-15T08:00:00Z",
    updated_at: "2026-03-15T09:00:00Z",
  },
];

// ── Mock Acting User ──

const ACTING_USER = "Juan Admin";

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
                          : "border-gray-300 bg-white text-gray-400"
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
                          : "border-gray-300 bg-white text-gray-400"
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
      label: `Approved by ${loan.approved_by}`,
      date: loan.approved_at,
      detail: loan.approval_remarks ?? undefined,
    });
  }

  if (loan.rejected_at) {
    events.push({
      icon: <Ban className="h-4 w-4 text-red-600" />,
      label: `Rejected by ${loan.rejected_by}`,
      date: loan.rejected_at,
      detail: loan.rejection_remarks ?? undefined,
    });
  }

  if (loan.released_at) {
    events.push({
      icon: <Unlock className="h-4 w-4 text-cyan-600" />,
      label: `Released by ${loan.released_by}`,
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

  const initialLoan = MOCK_LOANS.find((l) => l.id === loanId);
  const [loan, setLoan] = useState<Loan | undefined>(initialLoan);

  // Dialog state
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [releaseOpen, setReleaseOpen] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [releaseDatePickerOpen, setReleaseDatePickerOpen] = useState(false);

  const [approvalRemarks, setApprovalRemarks] = useState("");
  const [rejectionRemarks, setRejectionRemarks] = useState("");
  const [releaseDate, setReleaseDate] = useState<Date>(new Date());

  // Generated loan account number for release dialog
  const generatedAccountNumber = useMemo(
    () => (loan ? generateLoanAccountNumber(loan.id) : ""),
    [loan?.id],
  );

  // Amortization schedule preview for release dialog
  const releaseSchedule = useMemo(() => {
    if (!loan) return [];
    return generateSchedule(
      loan.principal_amount,
      loan.interest_rate,
      loan.term_months,
      loan.payment_frequency,
      loan.interest_type,
      releaseDate,
    );
  }, [loan?.principal_amount, loan?.interest_rate, loan?.term_months, loan?.payment_frequency, loan?.interest_type, releaseDate]);

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
    return addMonths(releaseDate, loan.term_months);
  }, [releaseDate, loan?.term_months]);

  // Post-release: compute stored schedule for display
  const storedSchedule = useMemo(() => {
    if (!loan || !loan.release_date) return [];
    const isReleased = ["released", "ongoing", "completed", "defaulted", "restructured", "closed"].includes(loan.status);
    if (!isReleased) return [];
    return generateSchedule(
      loan.principal_amount,
      loan.interest_rate,
      loan.term_months,
      loan.payment_frequency,
      loan.interest_type,
      new Date(loan.release_date),
    );
  }, [loan?.principal_amount, loan?.interest_rate, loan?.term_months, loan?.payment_frequency, loan?.interest_type, loan?.release_date, loan?.status]);

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

  const now = new Date().toISOString();

  const handleSubmitForReview = () => {
    setLoan({
      ...loan,
      status: "for_review",
      updated_at: now,
    });
    setSubmitOpen(false);
  };

  const handleApprove = () => {
    setLoan({
      ...loan,
      status: "approved",
      approved_by: ACTING_USER,
      approved_at: now,
      approval_remarks: approvalRemarks || undefined,
      updated_at: now,
    });
    setApprovalRemarks("");
    setApproveOpen(false);
  };

  const handleReject = () => {
    if (!rejectionRemarks.trim()) return;
    setLoan({
      ...loan,
      status: "rejected",
      rejected_by: ACTING_USER,
      rejected_at: now,
      rejection_remarks: rejectionRemarks,
      updated_at: now,
    });
    setRejectionRemarks("");
    setRejectOpen(false);
  };

  const handleRelease = () => {
    const releaseDateStr = formatDateISO(releaseDate);
    const maturityDate = addMonths(releaseDate, loan.term_months);
    const firstDueDate = releaseSchedule.length > 0
      ? formatDateISO(releaseSchedule[0].dueDate)
      : formatDateISO(addMonths(releaseDate, 1));

    setLoan({
      ...loan,
      status: "released",
      loan_account_number: generatedAccountNumber,
      released_by: ACTING_USER,
      released_at: now,
      release_date: releaseDateStr,
      maturity_date: formatDateISO(maturityDate),
      next_due_date: firstDueDate,
      outstanding_balance: scheduleTotals.totalPayment,
      updated_at: now,
    });
    setReleaseOpen(false);
  };

  const totalDeductions =
    (loan.processing_fee ?? 0) +
    (loan.service_fee ?? 0) +
    (loan.other_deductions ?? 0);

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
            <p className="text-lg text-foreground">{loan.borrower_name}</p>
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
                <span className="font-medium">{loan.rejected_by}</span> on{" "}
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
                  {loan.loan_product_name ?? "N/A"}
                </p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-muted-foreground">Purpose</p>
                <p className="text-sm font-medium">{loan.purpose ?? "N/A"}</p>
              </div>
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
                  {loan.interest_type}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  Term
                  {isLocked && <Lock className="h-3 w-3 text-muted-foreground" />}
                </p>
                <p className="text-sm font-medium">
                  {loan.term_months} months
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  Payment Frequency
                </p>
                <p className="text-sm font-medium">
                  {PAYMENT_FREQUENCY_LABELS[loan.payment_frequency] ??
                    loan.payment_frequency}
                </p>
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Total Payable</p>
                <p className="text-sm font-semibold">
                  {formatCurrency(loan.total_payable)}
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
                  {loan.processing_fee != null
                    ? formatCurrency(loan.processing_fee)
                    : "N/A"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Service Fee
                </span>
                <span className="text-sm font-medium">
                  {loan.service_fee != null
                    ? formatCurrency(loan.service_fee)
                    : "N/A"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Other Deductions
                </span>
                <span className="text-sm font-medium">
                  {loan.other_deductions != null
                    ? formatCurrency(loan.other_deductions)
                    : "N/A"}
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

        {/* Card 3: Borrower & Co-Maker */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-muted-foreground" />
              Borrower & Co-Maker
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-xs text-muted-foreground">Borrower</p>
              <p className="text-sm font-medium">
                {loan.borrower_name ?? "N/A"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Co-Maker</p>
              <p className="text-sm font-medium">
                {loan.co_maker_name ?? "None"}
              </p>
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
                <p className="text-sm font-semibold">{formatCurrency(loan.outstanding_balance)}</p>
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
              <span className="font-medium">{loan.borrower_name}</span>.
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
              <span className="font-medium">{loan.borrower_name}</span>. Please
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
                  <p className="text-xs text-muted-foreground">Loan Account Number</p>
                  <p className="text-sm font-bold font-mono text-brand-orange">
                    {generatedAccountNumber}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Application Number</p>
                  <p className="text-sm font-medium font-mono">{loan.application_number}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Borrower</p>
                  <p className="text-sm font-medium">{loan.borrower_name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Loan Product</p>
                  <p className="text-sm font-medium">{loan.loan_product_name ?? "N/A"}</p>
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
                    {loan.interest_rate}% / <span className="capitalize">{loan.interest_type}</span>
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Term / Frequency</p>
                  <p className="text-sm font-medium">
                    {loan.term_months} months / {PAYMENT_FREQUENCY_LABELS[loan.payment_frequency]}
                  </p>
                </div>
              </div>
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
    </div>
  );
}
