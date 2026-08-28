"use client";

import { useState, useMemo, useCallback, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { notifyError, notifyValidation } from "@/lib/notify";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarIcon,
  ChevronsUpDown,
  Check,
  Plus,
  X,
} from "lucide-react";

import { RouteGuard } from "@/components/common";
import { IncompleteListNotice } from "@/components/common/incomplete-list-notice";
import {
  collateralLock,
  holdersSentence,
  isLocked as isCollateralLocked,
  lockLabel,
} from "@/lib/collateral-lock";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

import {
  borrowerService,
  collateralService,
  collateralTypeService,
  loanProductService,
  loanService,
  userService,
} from "@/services";
import {
  SHARE_CAPITAL_UNAVAILABLE_LABEL,
  getShareCapitalBalance,
} from "@/utils/share-capital";
import {
  collateralValue,
  type CollateralValueRow,
} from "@/utils/collateral-value";
import { computeSecurityStatus, securityStatusLabel } from "@/types/collateral";
import { formatCurrency, formatDateObj, formatDateISO, formatDate } from "@/lib/format";
import { buildLoanDeductions, calcRestructureShortfall } from "@/lib/loan-restructure";
import {
  INTEREST_TYPE_OPTIONS,
  PAYMENT_FREQUENCY_LABELS,
  PAYMENT_FREQUENCY_OPTIONS,
  LOAN_STATUS_LABELS,
} from "@/constants";

import type { Borrower, CollateralType, Loan, LoanStatus, User } from "@/types";
import type { LoanProduct } from "@/types/loan";

// ── Local types ──────────────────────────────────────────────────────────────

type PaymentFrequency =
  | "daily"
  | "weekly"
  | "bi_weekly"
  | "semi_monthly"
  | "monthly"
  | "upon_maturity";

type InterestType = "straight" | "fixed" | "diminishing";

interface AmortizationRow {
  period: number;
  dueDate: Date;
  principal: number;
  interest: number;
  shareCapitalBuildUp: number;
  totalPayment: number;
}

// ── Amortization helpers (mirrors new/page.tsx) ───────────────────────────────

function getPeriodsFromMonths(termMonths: number, frequency: PaymentFrequency): number {
  switch (frequency) {
    case "daily": return Math.round(termMonths * 30);
    case "weekly": return Math.round(termMonths * 4.33);
    case "bi_weekly":
    case "semi_monthly": return Math.round(termMonths * 2);
    case "monthly":
    default: return termMonths;
  }
}

function getIntervalDays(frequency: PaymentFrequency): number {
  switch (frequency) {
    case "daily": return 1;
    case "weekly": return 7;
    case "bi_weekly":
    case "semi_monthly": return 15;
    case "monthly":
    default: return 30;
  }
}

function addMonthsToDate(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function addDaysToDate(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function computeAmortization(
  principal: number,
  interestRate: number,
  interestType: InterestType,
  termMonths: number,
  frequency: PaymentFrequency,
  startDate: Date,
  scbAmount = 0,
): AmortizationRow[] {
  const r = interestRate / 100;
  const scb = Math.round(scbAmount);

  if (frequency === "upon_maturity") {
    const totalInterest = Math.round(principal * r * termMonths);
    return [{
      period: 1,
      dueDate: addMonthsToDate(startDate, termMonths),
      principal,
      interest: totalInterest,
      shareCapitalBuildUp: scb,
      totalPayment: principal + totalInterest + scb,
    }];
  }

  const totalPeriods = getPeriodsFromMonths(termMonths, frequency);
  const intervalDays = getIntervalDays(frequency);
  const rows: AmortizationRow[] = [];
  let remaining = principal;

  if (interestType === "straight" || interestType === "fixed") {
    const principalPerPeriod = Math.round(principal / totalPeriods);
    const interestPerPeriod = Math.round(principal * r);
    for (let i = 1; i <= totalPeriods; i++) {
      const dueDate = frequency === "monthly"
        ? addMonthsToDate(startDate, i)
        : addDaysToDate(startDate, i * intervalDays);
      const periodPrincipal = i === totalPeriods ? remaining : principalPerPeriod;
      rows.push({ period: i, dueDate, principal: periodPrincipal, interest: interestPerPeriod, shareCapitalBuildUp: scb, totalPayment: periodPrincipal + interestPerPeriod + scb });
      remaining -= periodPrincipal;
    }
  } else if (interestType === "diminishing") {
    const pmt = r > 0 ? principal * r / (1 - Math.pow(1 + r, -totalPeriods)) : principal / totalPeriods;
    for (let i = 1; i <= totalPeriods; i++) {
      const dueDate = frequency === "monthly"
        ? addMonthsToDate(startDate, i)
        : addDaysToDate(startDate, i * intervalDays);
      const isLast = i === totalPeriods;
      const interest = Math.round(remaining * r);
      const periodPrincipal = isLast ? remaining : Math.round(pmt - interest);
      const baseTotal = isLast ? periodPrincipal + interest : Math.round(pmt);
      rows.push({ period: i, dueDate, principal: periodPrincipal, interest, shareCapitalBuildUp: scb, totalPayment: baseTotal + scb });
      remaining -= periodPrincipal;
    }
  }

  return rows;
}

// ── Active statuses eligible for restructure ─────────────────────────────────

/**
 * The statuses `POST /loans/{loan}/restructure` will actually accept.
 *
 * The API's own gate is `LoanService::assertRestructureInvariants()`:
 *
 *     if (! in_array($sourceLoan->status, ['released', 'ongoing'], true)) {
 *         throw ValidationException::withMessages([
 *             'status' => ['Only released or ongoing loans can be restructured.'],
 *         ]);
 *     }
 *
 * This list used to be `["current", "past_due", "released", "ongoing"]`. Two of
 * those are not members of the `loans.status` enum and no row can ever hold
 * them, so they widened this filter by exactly nothing — they were noise that
 * read as intent, and the parallel constant in `loans/_components/utils.ts` had
 * already been cleaned for the same reason.
 *
 * Note the annotation is documentation here, not a guard: the frontend
 * `LoanStatus` union still carries `current` and `past_due` as legacy members
 * (see `src/types/loan.ts`), so `["current", ...]` would still compile. Removing
 * them from that union is what would make this a build error, and it belongs
 * with the type, not here.
 *
 * NOT wired to `ACTIVE_STATUSES` in `loans/_components/utils.ts` even though the
 * two sets are identical today. That constant mirrors `Loan::ACTIVE_STATUSES`,
 * which the API expands `status=active` from; this one mirrors a literal array
 * written out separately in the restructure guard. They are two different rules
 * that happen to agree, and coupling them would silently move this filter the
 * day the active set changes.
 */
const ELIGIBLE_STATUSES: LoanStatus[] = ["released", "ongoing"];

// ── Main component ────────────────────────────────────────────────────────────

function RestructureLoanInner() {
  const router = useRouter();

  // ── Seed data ──
  const [borrowers, setBorrowers] = useState<Borrower[]>([]);
  const [products, setProducts] = useState<LoanProduct[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // ── Source loan selection ──
  const [borrowerId, setBorrowerId] = useState<number | null>(null);
  const [borrowerOpen, setBorrowerOpen] = useState(false);
  const [borrowerLoans, setBorrowerLoans] = useState<Loan[]>([]);
  const [loadingLoans, setLoadingLoans] = useState(false);
  const [sourceLoanId, setSourceLoanId] = useState<number | null>(null);
  const [loanOpen, setLoanOpen] = useState(false);
  const [loadingLoanDetail, setLoadingLoanDetail] = useState(false);
  /** Source loan's outstanding balance — the API rejects a lower principal without remarks. */
  const [sourceOutstanding, setSourceOutstanding] = useState<number | null>(null);

  // ── Form state ──
  const [coMakerIds, setCoMakerIds] = useState<(number | null)[]>([null]);
  const [openCoMakerIndex, setOpenCoMakerIndex] = useState<number | null>(null);
  const [accountOfficerId, setAccountOfficerId] = useState<number | null>(null);
  const [aoOpen, setAoOpen] = useState(false);
  const [purpose, setPurpose] = useState("");
  const [productId, setProductId] = useState<string | null>(null);
  const [principalAmount, setPrincipalAmount] = useState<string>("");
  const [termMonths, setTermMonths] = useState<string>("");
  const [paymentFrequency, setPaymentFrequency] = useState<string | null>(null);
  const [interestRate, setInterestRate] = useState<string>("");
  const [scbAmount, setScbAmount] = useState<string>("");
  const [restructureDate, setRestructureDate] = useState<Date | undefined>(new Date());
  const [restructureDateOpen, setRestructureDateOpen] = useState(false);
  const [processingFeeRate, setProcessingFeeRate] = useState<string>("");
  const [serviceFeeRate, setServiceFeeRate] = useState<string>("");
  const [editingFeeRate, setEditingFeeRate] = useState<"processing" | "service" | null>(null);
  const [otherDeductions, setOtherDeductions] = useState<{ name: string; amount: string }[]>([]);
  const [remarks, setRemarks] = useState("");
  const [policyException, setPolicyException] = useState(false);
  const [policyExceptionDetails, setPolicyExceptionDetails] = useState("");

  // ── Collaterals ──
  const [availableCollaterals, setAvailableCollaterals] = useState<CollateralValueRow[]>([]);
  const [collateralTypes, setCollateralTypes] = useState<CollateralType[]>([]);
  const [selectedCollaterals, setSelectedCollaterals] = useState<
    { collateral: CollateralValueRow; snapshot_value: number }[]
  >([]);
  const [collateralPickerOpen, setCollateralPickerOpen] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [formVisible, setFormVisible] = useState(false);
  // Set only when the member drain gave up with pages outstanding, i.e. the
  // borrower picker is knowingly missing people. Null means complete.
  const [memberShortfall, setMemberShortfall] = useState<{
    shown: number;
    total: number | null;
  } | null>(null);
  // Same, for the selected member's loan list: set only when that drain gave up
  // with pages outstanding, so the "which loan to restructure" picker is
  // knowingly missing loans. Null means complete.
  const [loanShortfall, setLoanShortfall] = useState<{
    shown: number;
    total: number | null;
  } | null>(null);

  // ── Load seed data on mount ──
  useEffect(() => {
    async function fetchData() {
      const [borrowersRes, productsRes, usersRes] = await Promise.allSettled([
        // members_only: a rejected applicant must never be restructurable.
        // Drained across pages. `per_page: 200` was clamped to 100 by
        // BorrowerController without a word, so member 101 onwards could not be
        // picked and their loans could not be restructured from this screen.
        borrowerService.listAll({ members_only: 1 }),
        loanProductService.list(),
        userService.list(),
      ]);

      if (borrowersRes.status === "fulfilled") {
        const memberDrain = borrowersRes.value;
        setBorrowers(memberDrain.rows);
        setMemberShortfall(
          memberDrain.truncated
            ? { shown: memberDrain.rows.length, total: memberDrain.total }
            : null,
        );
      }
      if (productsRes.status === "fulfilled") {
        const raw = productsRes.value;
        setProducts(Array.isArray(raw) ? raw : (raw as { data: LoanProduct[] }).data ?? []);
      }
      if (usersRes.status === "fulfilled") {
        const raw = usersRes.value;
        const list = Array.isArray(raw) ? raw : (raw as { data: User[] }).data ?? [];
        setUsers(list.filter((u) => u.status === "active"));
      }

      setLoadingData(false);
    }
    fetchData();
  }, []);

  // ── Load borrower's eligible loans when borrower changes ──
  useEffect(() => {
    if (!borrowerId) {
      setBorrowerLoans([]);
      setSourceLoanId(null);
      setFormVisible(false);
      return;
    }
    setLoadingLoans(true);
    // Drained across pages, like the member fetch above. `per_page: 200` was
    // clamped to 100 by LoanController without a word, so a member past their
    // hundredth loan simply had no restructurable loans on this screen — which
    // reads as "there is nothing to restructure", not as a bug. The filter runs
    // client-side because `?status=` cannot express "eligible for restructure";
    // that set is a guard in LoanService, not a query the API exposes.
    loanService
      .listAll({ borrower_id: borrowerId })
      .then(({ rows, truncated, total }) => {
        setBorrowerLoans(rows.filter((l) => ELIGIBLE_STATUSES.includes(l.status)));
        setLoanShortfall(truncated ? { shown: rows.length, total } : null);
      })
      .catch(() => {
        setBorrowerLoans([]);
        setLoanShortfall(null);
      })
      .finally(() => setLoadingLoans(false));
  }, [borrowerId]);

  // ── Pre-fill form when source loan is selected ──
  useEffect(() => {
    if (!sourceLoanId) {
      setSourceOutstanding(null);
      setFormVisible(false);
      return;
    }
    setLoadingLoanDetail(true);
    Promise.allSettled([
      loanService.detail(sourceLoanId),
      loanService.summary(sourceLoanId),
    ]).then(([loanRes, summaryRes]) => {
      if (loanRes.status !== "fulfilled") {
        toast.error("We couldn't load the loan details. Please try again.");
        setLoadingLoanDetail(false);
        return;
      }
      const loan = loanRes.value;
      const summary = summaryRes.status === "fulfilled"
        ? (summaryRes.value as { outstanding_balance?: number })
        : null;

      // Pre-fill co-makers
      const cmIds = Array.isArray(loan.co_makers)
        ? loan.co_makers.map((c) => c.id).filter((id): id is number => typeof id === "number")
        : [];
      setCoMakerIds(cmIds.length > 0 ? cmIds : [null]);

      // Pre-fill AO + purpose
      const l = loan as unknown as Record<string, unknown>;
      setAccountOfficerId((l.account_officer_id as number | undefined) ?? null);
      setPurpose(loan.purpose ?? "");

      // Pre-fill product
      const pid = loan.loan_product?.id ?? loan.loan_product_id ?? null;
      setProductId(pid ? String(pid) : null);

      // Principal = outstanding balance
      const outstanding = summary?.outstanding_balance ?? loan.outstanding_balance ?? loan.principal_amount;
      setSourceOutstanding(outstanding != null ? Number(outstanding) : null);
      setPrincipalAmount(outstanding != null ? String(Math.round(Number(outstanding))) : "");

      // Terms. Interest type is not prefilled — it is snapshotted from the loan
      // product by the API, so the form derives it from the product instead.
      setTermMonths(String(loan.term ?? loan.term_months ?? ""));
      setPaymentFrequency(String(loan.frequency ?? loan.payment_frequency ?? "monthly"));
      setInterestRate(loan.interest_rate != null ? String(Math.round(Number(loan.interest_rate))) : "");
      setScbAmount(loan.scb_amount != null ? String(loan.scb_amount) : "");

      // Restructure date defaults to today
      setRestructureDate(new Date());

      // Recalculate deductions from the selected product
      const prod = products.find((p) => p.id === Number(pid));
      if (prod) {
        const ap = prod as unknown as Record<string, unknown>;
        const procPct = ap.max_processing_fee ?? ap.processing_fee ?? prod.processing_fee;
        const svcPct = ap.max_service_fee ?? ap.service_fee ?? prod.service_fee;
        setProcessingFeeRate(procPct != null ? String(Math.round(Number(procPct))) : "");
        setServiceFeeRate(svcPct != null ? String(Math.round(Number(svcPct))) : "");
      } else {
        setProcessingFeeRate("");
        setServiceFeeRate("");
      }
      setOtherDeductions([]);

      // Reasons and exceptions are specific to this restructure — never inherited.
      setRemarks("");
      setPolicyException(false);
      setPolicyExceptionDetails("");

      setFormVisible(true);
      setLoadingLoanDetail(false);
    });
  }, [sourceLoanId, products]);

  // ── Collateral types: load once ──
  useEffect(() => {
    collateralTypeService.list().then(setCollateralTypes).catch(() => {});
  }, []);

  // ── Available collaterals: rebuild when borrower changes ──
  useEffect(() => {
    if (!borrowerId) {
      setAvailableCollaterals([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        // One request. `active_loans` on each row answers the lock question
        // across the whole active book — no loan list, no per-loan fan-out.
        const collRows = await collateralService.list({
          borrower_id: borrowerId,
        });
        const typeById = new Map(collateralTypes.map((t) => [t.id, t]));
        const needsSc = collRows.some(
          (c) => typeById.get(c.collateral_type_id)?.source === "share_capital",
        );
        const scBalance = needsSc ? await getShareCapitalBalance(borrowerId) : null;
        const enriched: CollateralValueRow[] = collRows.map((c) => {
          const t = typeById.get(c.collateral_type_id);
          return {
            ...c,
            type: t,
            // The loan being restructured holds its own collateral; that is not
            // a conflict, it is the security carrying over to the replacement.
            lock: collateralLock(c, { exceptLoanId: sourceLoanId }),
            // `value_unknown` when a share-capital ledger could not be read in
            // full. The picker refuses those rows rather than carrying an
            // appraisal nobody computed onto the replacement loan.
            ...collateralValue(c, t, scBalance),
          };
        });
        if (!cancelled) setAvailableCollaterals(enriched);
      } catch {
        if (!cancelled) setAvailableCollaterals([]);
      }
    })();
    return () => { cancelled = true; };
  }, [borrowerId, collateralTypes, sourceLoanId]);

  // ── Pre-fill collaterals from source loan ──
  useEffect(() => {
    if (!sourceLoanId || collateralTypes.length === 0 || availableCollaterals.length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        const links = await collateralService.listForLoan(sourceLoanId);
        if (cancelled) return;
        const byId = new Map(availableCollaterals.map((c) => [c.id, c]));
        // Rows are CollateralResource objects — collateral id is `id`, booked
        // amount is under `pivot`. Read as `collateral_id`/`snapshot_value`
        // they were both undefined, so the source loan's collaterals never
        // carried into the restructure form.
        const prefilled = links
          .map((link) => {
            const c = byId.get(link.id);
            return c
              ? {
                  collateral: c,
                  snapshot_value:
                    link.pivot?.snapshot_value ?? c.effective_value,
                }
              : null;
          })
          .filter((v): v is { collateral: CollateralValueRow; snapshot_value: number } => v !== null);
        if (!cancelled) setSelectedCollaterals(prefilled);
      } catch {
        // Non-blocking
      }
    })();
    return () => { cancelled = true; };
  }, [sourceLoanId, collateralTypes, availableCollaterals]);

  // ── Derived values ──
  const selectedBorrower = useMemo(
    () => borrowers.find((b) => b.id === borrowerId) ?? null,
    [borrowers, borrowerId],
  );

  const selectedProduct = useMemo(
    () => (productId ? products.find((p) => p.id === Number(productId)) ?? null : null),
    [productId, products],
  );

  const selectedSourceLoan = useMemo(
    () => borrowerLoans.find((l) => l.id === sourceLoanId) ?? null,
    [borrowerLoans, sourceLoanId],
  );

  // Base UI resolves <SelectValue> labels from `items`, not from the mounted
  // <SelectItem> children — without it the trigger shows the raw value ("1").
  const productItems = useMemo(
    () => products.map((p) => ({ value: String(p.id), label: p.name })),
    [products],
  );

  // Interest type is display-only: the API snapshots `interest_method` from the
  // loan product and ignores anything the request sends, so the form shows the
  // product's actual method instead of letting the user pick one that is dropped.
  const interestType = useMemo<InterestType | null>(() => {
    if (!selectedProduct) return null;
    const ap = selectedProduct as unknown as Record<string, unknown>;
    const raw = String(ap.interest_method ?? selectedProduct.interest_type ?? "straight");
    return (raw === "fixed" ? "straight" : raw) as InterestType;
  }, [selectedProduct]);

  const interestTypeLabel = useMemo(
    () =>
      interestType
        ? INTEREST_TYPE_OPTIONS.find((o) => o.value === interestType)?.label ?? interestType
        : null,
    [interestType],
  );

  const principal = parseFloat(principalAmount) || 0;
  const term = parseInt(termMonths) || 0;
  const rate = parseFloat(interestRate) || 0;
  const scb = parseFloat(scbAmount) || 0;
  const processingFeePercent = parseFloat(processingFeeRate) || 0;
  const serviceFeePercent = parseFloat(serviceFeeRate) || 0;

  const processingFeeAmount = Math.round((processingFeePercent / 100) * principal);
  const serviceFeeAmount = Math.round((serviceFeePercent / 100) * principal);
  const otherDeductionsTotal = otherDeductions.reduce(
    (s, d) => s + (parseFloat(d.amount) || 0), 0,
  );
  const totalDeductions = processingFeeAmount + serviceFeeAmount + otherDeductionsTotal;
  const netProceeds = principal - totalDeductions;

  // Deductions travel with the payload so the new loan matches this preview
  // instead of falling back to the loan product's configured fees.
  const deductions = useMemo(
    () => buildLoanDeductions({ processingFeePercent, serviceFeePercent, otherDeductions }),
    [processingFeePercent, serviceFeePercent, otherDeductions],
  );

  // Restructuring for less than the outstanding balance writes the difference
  // off, so the API requires remarks explaining it.
  const shortfall = calcRestructureShortfall(principal, sourceOutstanding);
  const remarksRequired = shortfall > 0;

  const totalCollateralValue = useMemo(
    () => selectedCollaterals.reduce((s, c) => s + c.snapshot_value, 0),
    [selectedCollaterals],
  );
  const securityStatus = useMemo(
    () => principal > 0 ? computeSecurityStatus(principal, totalCollateralValue) : "unsecured",
    [principal, totalCollateralValue],
  );

  const productFrequencies = useMemo<string[]>(() => {
    if (!selectedProduct) return [];
    const ap = selectedProduct as unknown as Record<string, unknown>;
    const raw = ap.frequencies ?? ap.frequency ?? selectedProduct.payment_frequency;
    if (Array.isArray(raw)) return raw as string[];
    return raw ? [String(raw)] : [];
  }, [selectedProduct]);

  // Picker rows for collateral dialog
  const pickerRows = useMemo(() => {
    const selectedIds = new Set(selectedCollaterals.map((c) => c.collateral.id));
    return availableCollaterals.map((c) => ({
      collateral: c,
      isSelected: selectedIds.has(c.id),
      isLocked: isCollateralLocked(c.lock),
      // No value to snapshot onto the replacement loan, so it cannot be picked.
      isValueUnknown: c.value_unknown,
    }));
  }, [availableCollaterals, selectedCollaterals]);

  // Amortization preview
  const amortizationRows = useMemo<AmortizationRow[]>(() => {
    if (
      principal <= 0 ||
      term <= 0 ||
      rate <= 0 ||
      !paymentFrequency ||
      !interestType ||
      !restructureDate
    )
      return [];
    return computeAmortization(
      principal,
      rate,
      interestType as InterestType,
      term,
      paymentFrequency as PaymentFrequency,
      restructureDate,
      scb,
    );
  }, [principal, rate, term, paymentFrequency, interestType, restructureDate, scb]);

  const amortTotals = useMemo(
    () =>
      amortizationRows.reduce(
        (acc, r) => ({
          principal: acc.principal + r.principal,
          interest: acc.interest + r.interest,
          scb: acc.scb + r.shareCapitalBuildUp,
          total: acc.total + r.totalPayment,
        }),
        { principal: 0, interest: 0, scb: 0, total: 0 },
      ),
    [amortizationRows],
  );

  // ── Validation ──
  const principalError = useMemo(() => {
    if (!principalAmount) return null;
    if (principal <= 0) return "Amount must be greater than 0";
    if (selectedProduct) {
      if (principal < selectedProduct.min_amount) return `Minimum is ${formatCurrency(selectedProduct.min_amount)}`;
      if (principal > selectedProduct.max_amount) return `Maximum is ${formatCurrency(selectedProduct.max_amount)}`;
    }
    return null;
  }, [principalAmount, principal, selectedProduct]);

  const termError = useMemo(() => {
    if (!termMonths) return null;
    if (term <= 0) return "Term must be greater than 0";
    if (selectedProduct) {
      if (term < selectedProduct.min_term) return `Minimum is ${selectedProduct.min_term} months`;
      if (selectedProduct.max_term && term > selectedProduct.max_term) return `Maximum is ${selectedProduct.max_term} months`;
    }
    return null;
  }, [termMonths, term, selectedProduct]);

  // ── Handlers ──
  const handleBorrowerChange = useCallback((id: number | null) => {
    setBorrowerId(id);
    setSourceLoanId(null);
    setSelectedCollaterals([]);
    setFormVisible(false);
  }, []);

  const handleProductChange = useCallback(
    (value: string | null) => {
      setProductId(value);
      const prod = products.find((p) => p.id === Number(value));
      if (prod) {
        const ap = prod as unknown as Record<string, unknown>;
        const rawRate = ap.min_interest_rate ?? ap.interest_rate ?? prod.interest_rate;
        setInterestRate(rawRate != null ? String(Math.round(Number(rawRate))) : "");
        const rawFreqs = ap.frequencies ?? ap.frequency ?? prod.payment_frequency;
        const freqArr = Array.isArray(rawFreqs) ? rawFreqs as string[] : rawFreqs ? [String(rawFreqs)] : ["monthly"];
        setPaymentFrequency(String(freqArr[0] ?? "monthly"));
        const procPct = ap.max_processing_fee ?? ap.processing_fee ?? prod.processing_fee;
        const svcPct = ap.max_service_fee ?? ap.service_fee ?? prod.service_fee;
        setProcessingFeeRate(procPct != null ? String(Math.round(Number(procPct))) : "");
        setServiceFeeRate(svcPct != null ? String(Math.round(Number(svcPct))) : "");
        if (prod.scb_required) setScbAmount(String(prod.min_scb ?? ""));
        else setScbAmount("");
      }
    },
    [products],
  );

  const availableCoMakersFor = useCallback(
    (currentIndex: number) => {
      const pickedElsewhere = new Set(
        coMakerIds.filter((id, i) => id !== null && i !== currentIndex) as number[],
      );
      return borrowers.filter((b) => b.id !== borrowerId && !pickedElsewhere.has(b.id));
    },
    [borrowers, borrowerId, coMakerIds],
  );

  const handleSubmit = async () => {
    // Collect every field the user still needs to fix and surface them in a
    // single consolidated pop-up instead of inline red messages.
    const missing: string[] = [];
    if (borrowerId === null) missing.push("Borrower");
    if (sourceLoanId === null) missing.push("Source loan");
    if (productId === null) missing.push("Loan product");
    if (!(principal > 0) || principalError) missing.push("Principal amount");
    if (!(term > 0) || termError) missing.push("Term");
    if (paymentFrequency === null) missing.push("Payment frequency");
    if (!(rate > 0)) missing.push("Interest rate");
    if (restructureDate === undefined) missing.push("Restructure date");
    // A principal below the outstanding balance writes debt off — the API
    // rejects it (422) unless the reason is stated.
    if (remarksRequired && !remarks.trim()) missing.push("Remarks");
    if (missing.length > 0) {
      notifyValidation(missing);
      return;
    }
    if (!restructureDate || !sourceLoanId || !borrowerId || paymentFrequency === null) return;
    setSubmitting(true);
    try {
      // Contract: POST /loans/{loan}/restructure. The frequency field is
      // `frequency` (not `payment_frequency`), and `interest_method` is not
      // accepted — the API snapshots it from the loan product.
      const payload: Record<string, unknown> = {
        borrower_id: borrowerId,
        co_maker_ids: coMakerIds.filter((id): id is number => id !== null),
        loan_product_id: Number(productId),
        principal_amount: principal,
        // Terms the user actually approved in the amortization preview. Omitting
        // these made the API fall back to the loan product's defaults.
        term,
        frequency: paymentFrequency,
        interest_rate: rate,
        start_date: formatDateISO(restructureDate),
        deductions,
        ...(scb > 0 && { scb_amount: scb }),
        ...(accountOfficerId && { account_officer_id: accountOfficerId }),
        ...(purpose.trim() && { purpose: purpose.trim() }),
        ...(remarks.trim() && { remarks: remarks.trim() }),
        ...(policyException && {
          policy_exception: true,
          policy_exception_details: policyExceptionDetails.trim() || undefined,
        }),
      };

      const newLoan = await loanService.restructure(sourceLoanId, payload);

      // Attach the picked collaterals to the new loan — skipping any the API
      // already carried over. `LoanService::restructure()` is gaining that
      // carry-over, and `attach()` answers 422 for a collateral the loan
      // already holds, so attaching blind would turn the happy path into
      // "some collaterals failed to attach". Today this reads an empty list
      // and behaves exactly as before.
      if (selectedCollaterals.length > 0 && newLoan.id) {
        try {
          const carried = await collateralService
            .listForLoan(newLoan.id)
            .catch(() => []);
          const alreadyHeld = new Set(carried.map((l) => l.id));
          await Promise.all(
            selectedCollaterals
              .filter((s) => !alreadyHeld.has(s.collateral.id))
              .map((s) =>
                collateralService.attachToLoan(newLoan.id, s.collateral.id, s.snapshot_value),
              ),
          );
        } catch {
          toast.warning("Restructure created but some collaterals failed to attach.");
        }
      }

      // Auto-forward for review
      try {
        await loanService.submit(newLoan.id);
      } catch {
        toast.warning("Restructure created but could not be forwarded for review. Submit it manually from the loan detail page.");
      }

      toast.success("Restructure application submitted", {
        description: "Forwarded to Manager for approval.",
      });
      router.push(`/loans/${newLoan.id}`);
    } catch (err: unknown) {
      notifyError(err, "We couldn't restructure this loan. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Loading state ──
  if (loadingData) {
    return (
      <div className="flex min-h-[calc(100vh-6rem)] items-center justify-center">
        <Spinner className="size-6 text-muted-foreground" />
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <RouteGuard permission="loans:restructure" pageName="Restructure Loan">
      <div className="mx-auto w-full max-w-4xl space-y-6 pb-10">

        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon-sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Restructure Loan</h1>
            <p className="text-sm text-muted-foreground">
              Select a borrower and an active loan to restructure. All fields are pre-filled from the existing loan.
            </p>
          </div>
        </div>

        {memberShortfall && (
          <IncompleteListNotice
            shown={memberShortfall.shown}
            total={memberShortfall.total}
            noun="members"
            consequence="Some members are missing from the borrower picker below and cannot be selected."
          />
        )}

        {loanShortfall && (
          <IncompleteListNotice
            shown={loanShortfall.shown}
            total={loanShortfall.total}
            noun="loans"
            consequence="Some of this member's loans are missing from the source-loan picker below, so a restructurable loan may not be listed."
          />
        )}

        {/* ── Step 1: Source Loan Selection ── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Source Loan</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {/* Borrower combobox */}
            <div className="space-y-1.5">
              <Label>Borrower</Label>
              <Popover open={borrowerOpen} onOpenChange={setBorrowerOpen}>
                <PopoverTrigger
                  render={<Button variant="outline" role="combobox" className="w-full justify-between font-normal" />}
                >
                  {selectedBorrower
                    ? `${selectedBorrower.full_name} (${selectedBorrower.borrower_code})`
                    : "Select borrower…"}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search borrower…" />
                    <CommandList>
                      <CommandEmpty>No borrower found.</CommandEmpty>
                      <CommandGroup>
                        {borrowers.map((b) => (
                          <CommandItem
                            key={b.id}
                            value={`${b.full_name} ${b.borrower_code}`}
                            onSelect={() => {
                              handleBorrowerChange(b.id === borrowerId ? null : b.id);
                              setBorrowerOpen(false);
                            }}
                          >
                            <Check
                              className={cn("mr-2 h-4 w-4", borrowerId === b.id ? "opacity-100" : "opacity-0")}
                            />
                            {b.full_name}
                            <span className="ml-1 text-xs text-muted-foreground">
                              ({b.borrower_code})
                            </span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Active loan combobox */}
            <div className="space-y-1.5">
              <Label>Active Loan to Restructure</Label>
              {loadingLoans ? (
                <div className="flex h-10 items-center gap-2 rounded-md border px-3 text-sm text-muted-foreground">
                  <Spinner className="size-4" /> Loading loans…
                </div>
              ) : (
                <Popover open={loanOpen} onOpenChange={setLoanOpen}>
                  <PopoverTrigger
                    render={<Button variant="outline" role="combobox" disabled={!borrowerId} className="w-full justify-between font-normal" />}
                  >
                    {selectedSourceLoan
                      ? `${selectedSourceLoan.loan_account_number ?? selectedSourceLoan.application_number} — ${formatCurrency(selectedSourceLoan.outstanding_balance ?? selectedSourceLoan.principal_amount)}`
                      : borrowerId
                      ? borrowerLoans.length === 0
                        ? "No eligible loans"
                        : "Select loan…"
                      : "Select a borrower first"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search loan…" />
                      <CommandList>
                        <CommandEmpty>No eligible loans found.</CommandEmpty>
                        <CommandGroup>
                          {borrowerLoans.map((l) => (
                            <CommandItem
                              key={l.id}
                              value={`${l.loan_account_number ?? l.application_number} ${l.principal_amount}`}
                              onSelect={() => {
                                setSourceLoanId(l.id === sourceLoanId ? null : l.id);
                                setLoanOpen(false);
                              }}
                            >
                              <Check
                                className={cn("mr-2 h-4 w-4", sourceLoanId === l.id ? "opacity-100" : "opacity-0")}
                              />
                              <div className="flex flex-col">
                                <span className="font-mono text-sm">
                                  {l.loan_account_number ?? l.application_number}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {formatCurrency(l.principal_amount)} ·{" "}
                                  <Badge variant="outline" className="text-[10px] py-0 px-1">
                                    {LOAN_STATUS_LABELS[l.status] ?? l.status}
                                  </Badge>
                                </span>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Loading loan detail spinner */}
        {loadingLoanDetail && (
          <div className="flex items-center justify-center py-8">
            <Spinner className="size-6 text-brand-orange" />
            <span className="ml-2 text-sm text-muted-foreground">Loading loan details…</span>
          </div>
        )}

        {/* ── Form (shown after loan is selected + loaded) ── */}
        {formVisible && (
          <>
            {/* Member & Co-Maker */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Member & Co-Maker</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Borrower (locked) */}
                <div className="space-y-1.5">
                  <Label>Borrower</Label>
                  <div className="flex h-10 items-center rounded-md border bg-muted/40 px-3 text-sm">
                    {selectedBorrower?.full_name ?? "—"}
                    <Badge variant="outline" className="ml-2 text-xs">
                      {selectedBorrower?.borrower_code}
                    </Badge>
                  </div>
                </div>

                {/* Co-makers */}
                <div className="space-y-2">
                  <Label>Co-Maker(s)</Label>
                  {coMakerIds.map((cmId, idx) => (
                    <div key={idx} className="flex gap-2">
                      <Popover
                        open={openCoMakerIndex === idx}
                        onOpenChange={(open) => setOpenCoMakerIndex(open ? idx : null)}
                      >
                        <PopoverTrigger
                          render={<Button variant="outline" role="combobox" className="flex-1 justify-between font-normal" />}
                        >
                          {cmId
                            ? (() => {
                                const b = borrowers.find((b) => b.id === cmId);
                                return b ? `${b.full_name} (${b.borrower_code})` : "Unknown";
                              })()
                            : "Select co-maker (optional)"}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Search co-maker…" />
                            <CommandList>
                              <CommandEmpty>No members found.</CommandEmpty>
                              <CommandGroup>
                                {availableCoMakersFor(idx).map((b) => (
                                  <CommandItem
                                    key={b.id}
                                    value={`${b.full_name} ${b.borrower_code}`}
                                    onSelect={() => {
                                      setCoMakerIds((prev) =>
                                        prev.map((v, i) => (i === idx ? (v === b.id ? null : b.id) : v)),
                                      );
                                      setOpenCoMakerIndex(null);
                                    }}
                                  >
                                    <Check
                                      className={cn("mr-2 h-4 w-4", cmId === b.id ? "opacity-100" : "opacity-0")}
                                    />
                                    {b.full_name}
                                    <span className="ml-1 text-xs text-muted-foreground">({b.borrower_code})</span>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      {coMakerIds.length > 1 && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() =>
                            setCoMakerIds((prev) => {
                              const next = prev.filter((_, i) => i !== idx);
                              return next.length === 0 ? [null] : next;
                            })
                          }
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCoMakerIds((prev) => [...prev, null])}
                  >
                    <Plus className="mr-1.5 h-4 w-4" />
                    Add Co-Maker
                  </Button>
                </div>

                {/* Account Officer */}
                <div className="space-y-1.5">
                  <Label>Account Officer <span className="text-muted-foreground">(optional)</span></Label>
                  <Popover open={aoOpen} onOpenChange={setAoOpen}>
                    <PopoverTrigger
                      render={<Button variant="outline" role="combobox" className="w-full justify-between font-normal" />}
                    >
                      {accountOfficerId
                        ? (() => {
                            const u = users.find((u) => u.id === accountOfficerId);
                            return u?.full_name ?? "Unknown";
                          })()
                        : "Select account officer…"}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search officer…" />
                        <CommandList>
                          <CommandEmpty>No users found.</CommandEmpty>
                          <CommandGroup>
                            {users.map((u) => (
                              <CommandItem
                                key={u.id}
                                value={u.full_name}
                                onSelect={() => {
                                  setAccountOfficerId(u.id === accountOfficerId ? null : u.id);
                                  setAoOpen(false);
                                }}
                              >
                                <Check className={cn("mr-2 h-4 w-4", accountOfficerId === u.id ? "opacity-100" : "opacity-0")} />
                                {u.full_name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Purpose */}
                <div className="space-y-1.5">
                  <Label>Purpose <span className="text-muted-foreground">(optional)</span></Label>
                  <Textarea
                    placeholder="Loan purpose…"
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    rows={2}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Loan Product & Terms */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Loan Product & Terms</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  {/* Product */}
                  <div className="space-y-1.5">
                    <Label>Loan Product</Label>
                    <Select
                      value={productId ?? null}
                      onValueChange={(v) => handleProductChange(v)}
                      items={productItems}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select product…" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((p) => (
                          <SelectItem key={p.id} value={String(p.id)}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Loan Amount */}
                  <div className="space-y-1.5">
                    <Label>
                      Loan Amount
                      <span className="ml-1 text-xs text-muted-foreground">(outstanding balance)</span>
                    </Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={principalAmount}
                      onChange={(e) => setPrincipalAmount(e.target.value)}
                      aria-describedby={sourceOutstanding !== null ? "principal-hint" : undefined}
                    />
                    {sourceOutstanding !== null && (
                      <p
                        id="principal-hint"
                        className={cn(
                          "text-xs",
                          remarksRequired
                            ? "text-amber-600 dark:text-amber-500"
                            : "text-muted-foreground",
                        )}
                      >
                        {remarksRequired
                          ? `${formatCurrency(shortfall)} below the outstanding balance of ${formatCurrency(sourceOutstanding)} — remarks required.`
                          : `Outstanding balance: ${formatCurrency(sourceOutstanding)}`}
                      </p>
                    )}
                  </div>

                  {/* Term */}
                  <div className="space-y-1.5">
                    <Label>Term (months)</Label>
                    <Input
                      type="number"
                      min="1"
                      placeholder="e.g. 12"
                      value={termMonths}
                      onChange={(e) => setTermMonths(e.target.value)}
                    />
                  </div>

                  {/* Payment Frequency */}
                  <div className="space-y-1.5">
                    <Label>Payment Frequency</Label>
                    <Select
                      value={paymentFrequency ?? null}
                      onValueChange={(v) => setPaymentFrequency(v ?? null)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select frequency…">
                          {(value: string | null) =>
                            value ? PAYMENT_FREQUENCY_LABELS[value] ?? value : "Select frequency…"
                          }
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {PAYMENT_FREQUENCY_OPTIONS.filter(
                          (o) => productFrequencies.length === 0 || productFrequencies.includes(o.value),
                        ).map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Interest Rate */}
                  <div className="space-y-1.5">
                    <Label>Interest Rate (%)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="e.g. 2"
                      value={interestRate}
                      onChange={(e) => setInterestRate(e.target.value)}
                    />
                  </div>

                  {/* Interest Type — read-only: the API snapshots it from the product */}
                  <div className="space-y-1.5">
                    <Label htmlFor="interest-type">Interest Type</Label>
                    {/* <output> is labelable, so the read-only value keeps its label */}
                    <output
                      id="interest-type"
                      className="flex h-10 items-center rounded-md border bg-muted/40 px-3 text-sm"
                    >
                      {interestTypeLabel ?? (
                        <span className="text-muted-foreground">Select a product first</span>
                      )}
                    </output>
                    <p className="text-xs text-muted-foreground">Set by loan product</p>
                  </div>

                  {/* SCB Amount */}
                  {selectedProduct?.scb_required && (
                    <div className="space-y-1.5">
                      <Label>
                        Share Capital Build-Up
                        {selectedProduct.min_scb != null && selectedProduct.max_scb != null && (
                          <span className="ml-1 text-xs text-muted-foreground">
                            ({formatCurrency(selectedProduct.min_scb)} – {formatCurrency(selectedProduct.max_scb)})
                          </span>
                        )}
                      </Label>
                      <Input
                        type="number"
                        min={selectedProduct.min_scb ?? 0}
                        max={selectedProduct.max_scb ?? undefined}
                        step="1"
                        placeholder="0"
                        value={scbAmount}
                        onChange={(e) => setScbAmount(e.target.value)}
                      />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Collaterals */}
            <Card>
              <CardHeader className="flex flex-row items-start justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-base">
                    Collaterals
                    <Badge variant="outline" className="ml-2 text-xs">
                      {securityStatusLabel(securityStatus)}
                    </Badge>
                  </CardTitle>
                  {/* The source loan's security carries over to the replacement
                      rather than being released — say so, because the picker
                      below now shows those same collaterals as held and an
                      operator could otherwise read that as a conflict. */}
                  <p className="text-sm text-muted-foreground">
                    The source loan&rsquo;s collaterals carry over to the
                    replacement loan. Restructuring does not release them.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCollateralPickerOpen(true)}
                  disabled={!borrowerId}
                >
                  <Plus className="mr-1.5 h-4 w-4" />
                  Manage
                </Button>
              </CardHeader>
              <CardContent>
                {selectedCollaterals.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No collaterals attached.</p>
                ) : (
                  <div className="space-y-2">
                    {selectedCollaterals.map(({ collateral, snapshot_value }) => (
                      <div
                        key={collateral.id}
                        className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                      >
                        <span>{collateral.detail_value ?? collateral.type?.name ?? "Collateral"}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{formatCurrency(snapshot_value)}</span>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() =>
                              setSelectedCollaterals((prev) =>
                                prev.filter((c) => c.collateral.id !== collateral.id),
                              )
                            }
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    <div className="flex justify-end pt-1 text-sm font-medium">
                      Total: {formatCurrency(totalCollateralValue)}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Collateral Picker Dialog */}
            <Dialog open={collateralPickerOpen} onOpenChange={setCollateralPickerOpen}>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Select Collaterals</DialogTitle>
                </DialogHeader>
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {pickerRows.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      No collaterals found for this borrower.
                    </p>
                  ) : (
                    pickerRows.map(({ collateral, isSelected, isLocked, isValueUnknown }) => (
                      <button
                        key={collateral.id}
                        disabled={(isLocked && !isSelected) || (isValueUnknown && !isSelected)}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedCollaterals((prev) =>
                              prev.filter((c) => c.collateral.id !== collateral.id),
                            );
                          } else {
                            setSelectedCollaterals((prev) => [
                              ...prev,
                              { collateral, snapshot_value: collateral.effective_value ?? collateral.amount },
                            ]);
                          }
                        }}
                        className={cn(
                          "flex w-full items-center justify-between rounded-md border px-3 py-2 text-sm transition-colors",
                          isSelected
                            ? "border-brand-orange bg-brand-orange/5"
                            : "hover:bg-muted/50",
                          isLocked && !isSelected && "opacity-50 cursor-not-allowed",
                          isValueUnknown && !isSelected && "opacity-50 cursor-not-allowed",
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className={cn(
                              "h-4 w-4 rounded border flex items-center justify-center",
                              isSelected && "bg-brand-orange border-brand-orange",
                            )}
                          >
                            {isSelected && <Check className="h-3 w-3 text-white" />}
                          </div>
                          <span>{collateral.detail_value ?? collateral.type?.name ?? "Collateral"}</span>
                          {/* Shown even when selected. A collateral carried over
                              from the source loan can ALSO be held by a third
                              active loan, and that is exactly the case
                              `attach()` will refuse with a 422 — so the conflict
                              has to be visible before submit, not after. Still
                              clickable when selected, so the operator can drop
                              it and proceed. */}
                          {isLocked && (
                            <Badge
                              variant="outline"
                              className="text-[10px]"
                              title={holdersSentence(collateral.lock) ?? undefined}
                            >
                              {lockLabel(collateral.lock) ?? "Locked"}
                            </Badge>
                          )}
                        </div>
                        <span
                          className={
                            isValueUnknown
                              ? "text-amber-700 dark:text-amber-500"
                              : "text-muted-foreground"
                          }
                        >
                          {isValueUnknown
                            ? SHARE_CAPITAL_UNAVAILABLE_LABEL
                            : formatCurrency(collateral.effective_value ?? collateral.amount)}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </DialogContent>
            </Dialog>

            {/* Restructure Date */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Restructure Date</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Date Restructured (new release date)</Label>
                  <Popover open={restructureDateOpen} onOpenChange={setRestructureDateOpen}>
                    <PopoverTrigger
                      render={<Button variant="outline" className="w-full justify-start font-normal" />}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {restructureDate ? formatDateObj(restructureDate) : "Pick a date"}
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={restructureDate}
                        onSelect={(date) => {
                          setRestructureDate(date);
                          setRestructureDateOpen(false);
                        }}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                {restructureDate && term > 0 && (
                  <div className="space-y-1.5">
                    <Label>Projected Maturity Date</Label>
                    <div className="flex h-10 items-center rounded-md border bg-muted/40 px-3 text-sm text-muted-foreground">
                      {formatDateObj(addMonthsToDate(restructureDate, term))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Deductions & Net Proceeds */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Deductions & Net Proceeds</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  {/* Processing Fee */}
                  <div className="space-y-1.5">
                    <Label>Processing Fee (%)</Label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="1"
                        value={editingFeeRate === "processing" ? processingFeeRate : processingFeeRate}
                        onChange={(e) => {
                          setEditingFeeRate("processing");
                          setProcessingFeeRate(e.target.value);
                        }}
                        onBlur={() => setEditingFeeRate(null)}
                        className="w-24"
                      />
                      <div className="flex h-10 flex-1 items-center rounded-md border bg-muted/40 px-3 text-sm text-muted-foreground">
                        {formatCurrency(processingFeeAmount)}
                      </div>
                    </div>
                  </div>

                  {/* Service Fee */}
                  <div className="space-y-1.5">
                    <Label>Service Fee (%)</Label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="1"
                        value={serviceFeeRate}
                        onChange={(e) => {
                          setEditingFeeRate("service");
                          setServiceFeeRate(e.target.value);
                        }}
                        onBlur={() => setEditingFeeRate(null)}
                        className="w-24"
                      />
                      <div className="flex h-10 flex-1 items-center rounded-md border bg-muted/40 px-3 text-sm text-muted-foreground">
                        {formatCurrency(serviceFeeAmount)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Other deductions */}
                <div className="space-y-2">
                  <Label>Other Deductions</Label>
                  {otherDeductions.map((d, idx) => (
                    <div key={idx} className="flex gap-2">
                      <Input
                        placeholder="Label"
                        value={d.name}
                        onChange={(e) =>
                          setOtherDeductions((prev) =>
                            prev.map((x, i) => (i === idx ? { ...x, name: e.target.value } : x)),
                          )
                        }
                        className="flex-1"
                      />
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={d.amount}
                        onChange={(e) =>
                          setOtherDeductions((prev) =>
                            prev.map((x, i) => (i === idx ? { ...x, amount: e.target.value } : x)),
                          )
                        }
                        className="w-32"
                      />
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() =>
                          setOtherDeductions((prev) => prev.filter((_, i) => i !== idx))
                        }
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setOtherDeductions((prev) => [...prev, { name: "", amount: "" }])}
                  >
                    <Plus className="mr-1.5 h-4 w-4" />
                    Add Deduction
                  </Button>
                </div>

                <Separator />

                {/* Totals */}
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Loan Amount</span>
                    <span>{formatCurrency(principal)}</span>
                  </div>
                  <div className="flex justify-between text-red-600 dark:text-red-400">
                    <span>Total Deductions</span>
                    <span>- {formatCurrency(totalDeductions)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-semibold">
                    <span>Net Proceeds</span>
                    <span>{formatCurrency(netProceeds)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Remarks & Policy Exception */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Remarks & Policy Exception</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {remarksRequired && (
                  <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50/50 p-3 text-sm dark:border-amber-700 dark:bg-amber-900/10">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                    <p>
                      The new principal is {formatCurrency(shortfall)}{" "}
                      below this loan&rsquo;s outstanding balance of{" "}
                      {formatCurrency(sourceOutstanding ?? 0)}. The difference is written
                      off, so a reason is required.
                    </p>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="remarks">
                    Remarks{" "}
                    {remarksRequired ? (
                      <span className="text-destructive">*</span>
                    ) : (
                      <span className="text-muted-foreground">(optional)</span>
                    )}
                  </Label>
                  <Textarea
                    id="remarks"
                    placeholder={
                      remarksRequired
                        ? "Explain why the restructured principal is below the outstanding balance…"
                        : "Notes about this restructure…"
                    }
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    rows={3}
                    required={remarksRequired}
                    aria-invalid={remarksRequired && !remarks.trim()}
                  />
                </div>

                <Separator />

                <div className="flex items-start gap-3">
                  <Checkbox
                    id="policy-exception"
                    checked={policyException}
                    onCheckedChange={(checked) => {
                      setPolicyException(checked === true);
                      if (!checked) setPolicyExceptionDetails("");
                    }}
                  />
                  <div>
                    <Label htmlFor="policy-exception" className="cursor-pointer font-medium">
                      Policy Exception
                    </Label>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Check this if the restructure requires policy exception approval (full BOD
                      review)
                    </p>
                  </div>
                </div>

                {policyException && (
                  <div className="space-y-1.5 rounded-lg border border-amber-300 bg-amber-50/50 p-4 dark:border-amber-700 dark:bg-amber-900/10">
                    <Label htmlFor="policy-exception-details">Policy Exception Details</Label>
                    <Textarea
                      id="policy-exception-details"
                      placeholder="Describe why this restructure requires a policy exception…"
                      value={policyExceptionDetails}
                      onChange={(e) => setPolicyExceptionDetails(e.target.value)}
                      rows={3}
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Amortization Preview */}
            {amortizationRows.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Amortization Preview
                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                      ({amortizationRows.length} periods)
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="max-h-64 overflow-y-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">#</TableHead>
                          <TableHead>Due Date</TableHead>
                          <TableHead className="text-right">Principal</TableHead>
                          <TableHead className="text-right">Interest</TableHead>
                          {scb > 0 && <TableHead className="text-right">SCB</TableHead>}
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {amortizationRows.map((row) => (
                          <TableRow key={row.period}>
                            <TableCell className="text-muted-foreground">{row.period}</TableCell>
                            <TableCell>{formatDate(row.dueDate.toISOString())}</TableCell>
                            <TableCell className="text-right">{formatCurrency(row.principal)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(row.interest)}</TableCell>
                            {scb > 0 && <TableCell className="text-right">{formatCurrency(row.shareCapitalBuildUp)}</TableCell>}
                            <TableCell className="text-right font-medium">{formatCurrency(row.totalPayment)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                      <TableFooter>
                        <TableRow>
                          <TableCell colSpan={2} className="font-semibold">Total</TableCell>
                          <TableCell className="text-right font-semibold">{formatCurrency(amortTotals.principal)}</TableCell>
                          <TableCell className="text-right font-semibold">{formatCurrency(amortTotals.interest)}</TableCell>
                          {scb > 0 && <TableCell className="text-right font-semibold">{formatCurrency(amortTotals.scb)}</TableCell>}
                          <TableCell className="text-right font-semibold">{formatCurrency(amortTotals.total)}</TableCell>
                        </TableRow>
                      </TableFooter>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Submit */}
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => router.back()}>
                Cancel
              </Button>
              <Button
                disabled={submitting}
                onClick={handleSubmit}
                className="bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark"
              >
                {submitting && <Spinner className="mr-2 size-4" />}
                Submit Restructure Application
              </Button>
            </div>
          </>
        )}
      </div>
    </RouteGuard>
  );
}

export default function RestructureLoanPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[calc(100vh-6rem)] items-center justify-center">
          <Spinner className="size-6 text-muted-foreground" />
        </div>
      }
    >
      <RestructureLoanInner />
    </Suspense>
  );
}
