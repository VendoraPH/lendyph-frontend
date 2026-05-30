"use client";

import { useState, useMemo, useCallback, useEffect, Suspense } from "react";
import { RouteGuard } from "@/components/common";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, CalendarIcon, Info, ChevronsUpDown, Check, Plus, X, FileText, ShieldCheck, Trash2 } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import {
  borrowerService,
  coMakerService,
  collateralService,
  collateralTypeService,
  documentService,
  loanProductService,
  loanService,
  userService,
} from "@/services";
import { api } from "@/lib/api-client";
import { getShareCapitalBalance } from "@/utils/share-capital";
import {
  computeSecurityStatus,
  securityStatusLabel,
} from "@/types/collateral";
import type {
  Borrower,
  CoMaker,
  CollateralType,
  CollateralWithMeta,
  Loan,
  User,
} from "@/types";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { cn } from "@/lib/utils";

import type { LoanProduct } from "@/types/loan";
import {
  INTEREST_TYPE_OPTIONS,
  PAYMENT_FREQUENCY_OPTIONS,
  PAYMENT_FREQUENCY_LABELS,
} from "@/constants";

// ── Currency Formatter ──

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

// ── Helpers ──

type PaymentFrequency = "daily" | "weekly" | "bi_weekly" | "semi_monthly" | "monthly" | "upon_maturity";
type InterestType = "straight" | "fixed" | "diminishing";

function getPeriodsFromMonths(
  termMonths: number,
  frequency: PaymentFrequency
): number {
  switch (frequency) {
    case "daily":
      return Math.round(termMonths * 30);
    case "weekly":
      return Math.round(termMonths * 4.33);
    case "bi_weekly":
    case "semi_monthly":
      return Math.round(termMonths * 2);
    case "monthly":
    default:
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
    case "semi_monthly":
      return 15;
    case "monthly":
    default:
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

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateISO(date: Date): string {
  return date.toISOString().split("T")[0];
}

interface AmortizationRow {
  period: number;
  dueDate: Date;
  principal: number;
  interest: number;
  shareCapitalBuildUp: number;
  totalPayment: number;
}

function computeAmortization(
  principal: number,
  interestRate: number,
  interestType: InterestType,
  termMonths: number,
  frequency: PaymentFrequency,
  releaseDate: Date,
  scbAmount: number = 0,
): AmortizationRow[] {
  const r = interestRate / 100;
  const scb = Math.round(scbAmount);

  // Upon Maturity is a bullet / balloon repayment schedule: one single
  // payment on the maturity date containing full principal + simple
  // interest for the whole term + any SCB. It's a payment-frequency
  // concept, not an interest-type concept — the interest type is still
  // straight or diminishing, but with no intermediate paydowns the two
  // converge to the same total here.
  if (frequency === "upon_maturity") {
    const totalInterest = Math.round(principal * r * termMonths);
    return [{
      period: 1,
      dueDate: addMonths(releaseDate, termMonths),
      principal,
      interest: totalInterest,
      shareCapitalBuildUp: scb,
      totalPayment: principal + totalInterest + scb,
    }];
  }

  const totalPeriods = getPeriodsFromMonths(termMonths, frequency);
  const intervalDays = getIntervalDays(frequency);
  const rows: AmortizationRow[] = [];
  let remainingBalance = principal;

  // Straight/Fixed: equal principal each period, constant interest on original principal
  if (interestType === "straight" || interestType === "fixed") {
    const principalPerPeriod = Math.round(principal / totalPeriods);
    const interestPerPeriod = Math.round(principal * r);

    for (let i = 1; i <= totalPeriods; i++) {
      const dueDate = frequency === "monthly"
        ? addMonths(releaseDate, i)
        : addDays(releaseDate, i * intervalDays);
      const isLast = i === totalPeriods;
      const periodPrincipal = isLast ? remainingBalance : principalPerPeriod;

      rows.push({
        period: i,
        dueDate,
        principal: periodPrincipal,
        interest: interestPerPeriod,
        shareCapitalBuildUp: scb,
        totalPayment: periodPrincipal + interestPerPeriod + scb,
      });
      remainingBalance -= periodPrincipal;
    }
  }

  // Diminishing: equal total payment (PMT), decreasing interest, increasing principal
  else if (interestType === "diminishing") {
    const pmt = r > 0
      ? principal * r / (1 - Math.pow(1 + r, -totalPeriods))
      : principal / totalPeriods;

    for (let i = 1; i <= totalPeriods; i++) {
      const dueDate = frequency === "monthly"
        ? addMonths(releaseDate, i)
        : addDays(releaseDate, i * intervalDays);
      const isLast = i === totalPeriods;
      const interest = Math.round(remainingBalance * r);
      const periodPrincipal = isLast
        ? remainingBalance
        : Math.round(pmt - interest);
      const baseTotal = isLast ? periodPrincipal + interest : Math.round(pmt);

      rows.push({
        period: i,
        dueDate,
        principal: periodPrincipal,
        interest,
        shareCapitalBuildUp: scb,
        totalPayment: baseTotal + scb,
      });
      remainingBalance -= periodPrincipal;
    }
  }

  return rows;
}

// ── Main Page Component ──
//
// This page handles both **create** and **edit** for a loan application.
// Edit mode is triggered by `?edit={loanId}` — the Edit Loan Application
// button on `/loans/[id]` links here instead of opening an inline dialog
// so the Loan Processor gets the full form (product, term, frequency,
// interest type, policy exception, etc.) after a send-back, matching the
// New Loan experience exactly.

function NewLoanApplicationInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editLoanId = (() => {
    const raw = searchParams.get("edit");
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  })();
  const isEditMode = editLoanId !== null;

  // ── API Data ──
  const [borrowers, setBorrowers] = useState<Borrower[]>([]);
  const [products, setProducts] = useState<LoanProduct[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [existingLoan, setExistingLoan] = useState<Loan | null>(null);

  // ── Users (Account Officers) ──
  const [users, setUsers] = useState<User[]>([]);

  // ── Borrower & Co-Maker State ──
  const [borrowerId, setBorrowerId] = useState<number | null>(null);
  const [coMakerIds, setCoMakerIds] = useState<(number | null)[]>([null]);
  const [openCoMakerIndex, setOpenCoMakerIndex] = useState<number | null>(null);
  const [accountOfficerId, setAccountOfficerId] = useState<number | null>(null);
  const [aoOpen, setAoOpen] = useState(false);
  const [purpose, setPurpose] = useState("");

  // ── Loan Product & Terms State ──
  const [productId, setProductId] = useState<string | null>(null);
  const [principalAmount, setPrincipalAmount] = useState<string>("");
  const [termMonths, setTermMonths] = useState<string>("");
  const [paymentFrequency, setPaymentFrequency] = useState<string | null>(null);
  const [interestRate, setInterestRate] = useState<string>("");
  const [interestType, setInterestType] = useState<string | null>(null);
  // Share Capital Build-Up amount (only required when the selected
  // product has scb_required === true; must fall within product min/max)
  const [scbAmount, setScbAmount] = useState<string>("");

  // ── Collaterals State ──
  // Collaterals already persisted to mock storage and registered against
  // the chosen borrower. Re-fetched whenever the borrower changes.
  const [availableCollaterals, setAvailableCollaterals] = useState<
    CollateralWithMeta[]
  >([]);
  const [collateralTypes, setCollateralTypes] = useState<CollateralType[]>([]);
  // Collaterals the user has chosen to attach to THIS loan, with the
  // value snapshotted at attach time so post-attach ledger drift doesn't
  // silently move security status.
  const [selectedCollaterals, setSelectedCollaterals] = useState<
    { collateral: CollateralWithMeta; snapshot_value: number }[]
  >([]);
  const [collateralPickerOpen, setCollateralPickerOpen] = useState(false);

  // ── Policy Exception State ──
  const [policyException, setPolicyException] = useState(false);
  const [policyExceptionDetails, setPolicyExceptionDetails] = useState("");
  const [policyExceptionLetter, setPolicyExceptionLetter] = useState<File | null>(null);

  // ── Combobox Open State ──
  const [borrowerOpen, setBorrowerOpen] = useState(false);

  // ── Dates State ──
  const [releaseDate, setReleaseDate] = useState<Date | undefined>(new Date());
  const [releaseDateOpen, setReleaseDateOpen] = useState(false);

  // ── Deductions State ──
  // Fee rates are editable percentages constrained to the selected product's
  // min/max range. The peso amount is computed from rate × principal.
  const [processingFeeRate, setProcessingFeeRate] = useState<string>("");
  const [serviceFeeRate, setServiceFeeRate] = useState<string>("");
  const [editingFeeRate, setEditingFeeRate] = useState<"processing" | "service" | null>(null);
  const [otherDeductions, setOtherDeductions] = useState<{ name: string; amount: string }[]>([]);

  // ── Fetch borrowers, products, users — and the loan when editing ──
  useEffect(() => {
    async function fetchData() {
      setLoadingData(true);

      const [borrowersResult, productsResult, usersResult, loanResult] =
        await Promise.allSettled([
          borrowerService.list({ per_page: 200 }),
          loanProductService.list(),
          userService.list(),
          editLoanId ? loanService.detail(editLoanId) : Promise.resolve(null),
        ]);

      if (borrowersResult.status === "fulfilled") {
        const borrowerData = Array.isArray(borrowersResult.value)
          ? borrowersResult.value
          : (borrowersResult.value as { data: Borrower[] }).data ?? [];
        setBorrowers(borrowerData);
      } else {
        toast.error("Failed to load members");
      }

      let productsList: LoanProduct[] = [];
      if (productsResult.status === "fulfilled") {
        productsList = Array.isArray(productsResult.value)
          ? productsResult.value
          : (productsResult.value as unknown as { data: LoanProduct[] }).data ?? [];
        setProducts(productsList);
      } else {
        toast.error("Failed to load loan products");
      }

      if (usersResult.status === "fulfilled") {
        const userData = Array.isArray(usersResult.value)
          ? usersResult.value
          : (usersResult.value as unknown as { data: User[] }).data ?? [];
        setUsers(userData.filter((u) => u.status === "active"));
      }

      // Hydrate form state from the loan being edited. Runs after products
      // are loaded so the product-change handler (if used) has them, but
      // we set fields directly to avoid clobbering fee ranges the user may
      // have already tuned on this specific loan.
      if (editLoanId) {
        if (loanResult.status === "fulfilled" && loanResult.value) {
          const loan = loanResult.value;
          setExistingLoan(loan);
          const l = loan as unknown as Record<string, unknown>;
          const borrowerIdVal = loan.borrower?.id ?? loan.borrower_id ?? null;
          if (borrowerIdVal) setBorrowerId(Number(borrowerIdVal));
          const coMakerIdList: number[] = Array.isArray(loan.co_makers)
            ? loan.co_makers.map((c) => c.id).filter((id): id is number => typeof id === "number")
            : [];
          setCoMakerIds(coMakerIdList.length > 0 ? coMakerIdList : [null]);
          const aoId = (l.account_officer_id as number | undefined) ?? null;
          if (aoId) setAccountOfficerId(aoId);
          setPurpose(loan.purpose ?? "");
          const productIdVal = loan.loan_product?.id ?? loan.loan_product_id ?? null;
          if (productIdVal) setProductId(String(productIdVal));
          setPrincipalAmount(String(loan.principal_amount ?? ""));
          setTermMonths(String(loan.term ?? loan.term_months ?? ""));
          setPaymentFrequency(String(loan.frequency ?? loan.payment_frequency ?? "monthly"));
          setInterestRate(loan.interest_rate != null ? String(Math.round(Number(loan.interest_rate))) : "");
          const rawInterest = String(loan.interest_method ?? loan.interest_type ?? "straight");
          setInterestType(rawInterest === "fixed" ? "straight" : rawInterest);
          setScbAmount(loan.scb_amount != null ? String(loan.scb_amount) : "");
          if (loan.start_date) setReleaseDate(new Date(loan.start_date));
          if (loan.policy_exception) {
            setPolicyException(true);
            setPolicyExceptionDetails(loan.policy_exception_details ?? "");
          }
        } else {
          toast.error("Failed to load loan — redirecting");
          router.push(`/loans/${editLoanId}`);
        }
      }

      setLoadingData(false);
    }
    fetchData();
    // Re-fetch if user switches between create and edit in the same tab
  }, [editLoanId, router]);

  // ── Collateral types: load once on mount ──
  useEffect(() => {
    let cancelled = false;
    collateralTypeService
      .list()
      .then((rows) => {
        if (!cancelled) setCollateralTypes(rows);
      })
      .catch(() => {
        // Non-blocking — picker will just lack type metadata.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Available collaterals: rebuild whenever the borrower changes ──
  // Filters out collaterals already locked to a different active loan
  // (in edit mode the loan being edited is excluded from the lock).
  useEffect(() => {
    if (borrowerId == null) {
      setAvailableCollaterals([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [collateralRows, loanRes] = await Promise.all([
          collateralService.list({ borrower_id: borrowerId }),
          loanService.list(),
        ]);
        const loans: Loan[] = Array.isArray(loanRes)
          ? (loanRes as Loan[])
          : ((loanRes as { data?: Loan[] }).data ?? []);
        const activeIndex = await collateralService.buildActiveLoanIndex(
          loans.map((l) => ({
            id: l.id,
            status: String(l.status),
            loan_account_number: l.loan_account_number,
          })),
        );
        const typeById = new Map(collateralTypes.map((t) => [t.id, t]));
        const needsScBalance = collateralRows.some(
          (c) =>
            typeById.get(c.collateral_type_id)?.source === "share_capital",
        );
        const scBalance = needsScBalance
          ? await getShareCapitalBalance(borrowerId)
          : 0;
        const enriched: CollateralWithMeta[] = collateralRows.map((c) => {
          const t = typeById.get(c.collateral_type_id);
          const isShareCapital = t?.source === "share_capital";
          const active = activeIndex.get(c.id);
          const lockedToOtherLoan =
            active && active.loan_id !== editLoanId ? active : undefined;
          return {
            ...c,
            type: t,
            active_loan_id: lockedToOtherLoan?.loan_id,
            active_loan_account_number: lockedToOtherLoan?.loan_account_number,
            effective_value: isShareCapital ? scBalance : c.amount,
          };
        });
        if (!cancelled) setAvailableCollaterals(enriched);
      } catch {
        if (!cancelled) setAvailableCollaterals([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [borrowerId, collateralTypes, editLoanId]);

  // ── Edit mode: prefill selected collaterals from the loan ──
  useEffect(() => {
    if (!editLoanId) return;
    if (collateralTypes.length === 0) return;
    if (availableCollaterals.length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        const links = await collateralService.listForLoan(editLoanId);
        if (cancelled) return;
        const byId = new Map(availableCollaterals.map((c) => [c.id, c]));
        const prefilled = links
          .map((link) => {
            const c = byId.get(link.collateral_id);
            return c
              ? { collateral: c, snapshot_value: link.snapshot_value }
              : null;
          })
          .filter(
            (
              v,
            ): v is {
              collateral: CollateralWithMeta;
              snapshot_value: number;
            } => v !== null,
          );
        setSelectedCollaterals(prefilled);
      } catch {
        // Non-blocking
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [editLoanId, collateralTypes, availableCollaterals]);

  // Co-makers: all borrowers except the selected borrower and already-picked co-makers
  const availableCoMakersFor = useCallback(
    (currentIndex: number) => {
      const pickedElsewhere = new Set(
        coMakerIds.filter((id, i) => id !== null && i !== currentIndex) as number[]
      );
      return borrowers.filter((b) => b.id !== borrowerId && !pickedElsewhere.has(b.id));
    },
    [borrowers, borrowerId, coMakerIds]
  );

  // ── Derived ──
  const selectedBorrower = useMemo(
    () => borrowers.find((b) => b.id === borrowerId) ?? null,
    [borrowerId, borrowers]
  );
  const selectedProduct = useMemo(
    () => (productId ? products.find((p) => p.id === Number(productId)) ?? null : null),
    [productId, products]
  );

  // Frequencies allowed by the selected product (empty = no product selected = all)
  const productFrequencies = useMemo<string[]>(() => {
    if (!selectedProduct) return [];
    const ap = selectedProduct as unknown as Record<string, unknown>;
    const raw = ap.frequencies ?? ap.frequency ?? selectedProduct.payment_frequency;
    if (Array.isArray(raw)) return raw as string[];
    return raw ? [String(raw)] : [];
  }, [selectedProduct]);

  const principal = parseFloat(principalAmount) || 0;
  const term = parseInt(termMonths) || 0;
  const rate = parseFloat(interestRate) || 0;
  const scb = parseFloat(scbAmount) || 0;

  // Validation messages
  const principalError = useMemo(() => {
    if (!selectedProduct || !principalAmount) return null;
    if (principal < selectedProduct.min_amount)
      return `Minimum amount is ${formatCurrency(selectedProduct.min_amount)}`;
    if (principal > selectedProduct.max_amount)
      return `Maximum amount is ${formatCurrency(selectedProduct.max_amount)}`;
    return null;
  }, [selectedProduct, principalAmount, principal]);

  const termError = useMemo(() => {
    if (!selectedProduct || !termMonths) return null;
    if (term < selectedProduct.min_term)
      return `Minimum term is ${selectedProduct.min_term} month(s)`;
    if (term > selectedProduct.max_term)
      return `Maximum term is ${selectedProduct.max_term} months`;
    return null;
  }, [selectedProduct, termMonths, term]);

  // SCB validation — required when the product says so; range-checked when
  // the product defines min/max. Otherwise optional (any value >= 0 is fine).
  const scbError = useMemo(() => {
    if (!scbAmount || scb === 0) {
      // Empty/zero SCB is only an error when the product requires it
      return selectedProduct?.scb_required
        ? "Share Capital Build-Up amount is required"
        : null;
    }
    if (scb < 0) return "SCB cannot be negative";
    const min = selectedProduct?.min_scb ?? 0;
    const max = selectedProduct?.max_scb ?? 0;
    if (min > 0 && scb < min) return `Minimum SCB is ${formatCurrency(min)}`;
    if (max > 0 && scb > max) return `Maximum SCB is ${formatCurrency(max)}`;
    return null;
  }, [selectedProduct, scbAmount, scb]);

  // Fees — percent × principal. The percent is user-editable but bounded
  // by the product's min/max range (if defined on the product).
  const processingFeeRange = useMemo(() => ({
    min: Math.round(Number(selectedProduct?.min_processing_fee ?? 0)),
    max: Math.round(Number(selectedProduct?.max_processing_fee ?? selectedProduct?.processing_fee ?? 0)),
  }), [selectedProduct]);
  const serviceFeeRange = useMemo(() => ({
    min: Math.round(Number(selectedProduct?.min_service_fee ?? 0)),
    max: Math.round(Number(selectedProduct?.max_service_fee ?? selectedProduct?.service_fee ?? 0)),
  }), [selectedProduct]);


  const processingFeePercent = parseFloat(processingFeeRate) || (selectedProduct?.processing_fee ?? 0);
  const serviceFeePercent = parseFloat(serviceFeeRate) || (selectedProduct?.service_fee ?? 0);
  const processingFee = Math.round(principal * (processingFeePercent / 100));
  const serviceFee = Math.round(principal * (serviceFeePercent / 100));

  const processingFeePercentError = useMemo(() => {
    if (!selectedProduct || processingFeeRange.max <= 0) return null;
    if (processingFeePercent < processingFeeRange.min || processingFeePercent > processingFeeRange.max) {
      return `Must be between ${processingFeeRange.min}% and ${processingFeeRange.max}%`;
    }
    return null;
  }, [selectedProduct, processingFeePercent, processingFeeRange]);

  const serviceFeePercentError = useMemo(() => {
    if (!selectedProduct || serviceFeeRange.max <= 0) return null;
    if (serviceFeePercent < serviceFeeRange.min || serviceFeePercent > serviceFeeRange.max) {
      return `Must be between ${serviceFeeRange.min}% and ${serviceFeeRange.max}%`;
    }
    return null;
  }, [selectedProduct, serviceFeePercent, serviceFeeRange]);

  const otherDed = otherDeductions.reduce((sum, d) => sum + Math.round(parseFloat(d.amount) || 0), 0);
  const totalDeductions = processingFee + serviceFee + otherDed;
  const netProceeds = principal - totalDeductions;

  // Maturity date
  const maturityDate = useMemo(() => {
    if (!releaseDate || !term) return null;
    return addMonths(releaseDate, term);
  }, [releaseDate, term]);

  // Amortization preview — shown as soon as the core loan terms are valid.
  // SCB errors do NOT block the preview (we want the user to see the SCB
  // column with their current value); SCB errors only block submission.
  const canShowAmortization =
    principal > 0 &&
    term > 0 &&
    rate > 0 &&
    paymentFrequency !== null &&
    interestType !== null &&
    releaseDate !== undefined &&
    !principalError &&
    !termError;

  const amortizationSchedule = useMemo(() => {
    if (!canShowAmortization || !releaseDate || !paymentFrequency || !interestType)
      return [];
    return computeAmortization(
      principal,
      rate,
      interestType as InterestType,
      term,
      paymentFrequency as PaymentFrequency,
      releaseDate,
      scb,
    );
  }, [
    canShowAmortization,
    principal,
    rate,
    interestType,
    term,
    paymentFrequency,
    releaseDate,
    scb,
  ]);

  const amortizationTotals = useMemo(() => {
    return amortizationSchedule.reduce(
      (acc, row) => ({
        principal: acc.principal + row.principal,
        interest: acc.interest + row.interest,
        shareCapitalBuildUp: acc.shareCapitalBuildUp + row.shareCapitalBuildUp,
        totalPayment: acc.totalPayment + row.totalPayment,
      }),
      { principal: 0, interest: 0, shareCapitalBuildUp: 0, totalPayment: 0 }
    );
  }, [amortizationSchedule]);

  // ── Collaterals: total snapshot value + security status ──
  const totalCollateralValue = useMemo(
    () => selectedCollaterals.reduce((sum, c) => sum + c.snapshot_value, 0),
    [selectedCollaterals],
  );
  const securityStatus = useMemo(
    () =>
      principal > 0
        ? computeSecurityStatus(principal, totalCollateralValue)
        : "unsecured",
    [principal, totalCollateralValue],
  );
  // Picker rows: show all of the borrower's collaterals, but disable the
  // ones already selected here or locked to a different active loan.
  const pickerRows = useMemo(() => {
    const selectedIds = new Set(
      selectedCollaterals.map((c) => c.collateral.id),
    );
    return availableCollaterals.map((c) => ({
      collateral: c,
      isSelected: selectedIds.has(c.id),
      isLocked: Boolean(c.active_loan_id),
    }));
  }, [availableCollaterals, selectedCollaterals]);

  // ── Product Selection Handler ──
  const handleProductChange = useCallback(
    (value: string | null) => {
      setProductId(value);
      const product = products.find((p) => p.id === Number(value));
      if (product) {
        const apiProduct = product as unknown as Record<string, unknown>;
        const rawRate = apiProduct.min_interest_rate ?? apiProduct.interest_rate ?? product.interest_rate;
        setInterestRate(rawRate != null ? String(Math.round(Number(rawRate))) : "");
        // Map API field names: interest_method/interest_type, "fixed" -> "straight"
        const rawType = String(apiProduct.interest_method ?? product.interest_type ?? "straight");
        setInterestType(rawType === "fixed" ? "straight" : rawType);
        // Auto-select payment frequency from the product's frequencies array
        const rawFreqs = apiProduct.frequencies ?? apiProduct.frequency ?? product.payment_frequency;
        const freqArray = Array.isArray(rawFreqs) ? rawFreqs as string[] : rawFreqs ? [String(rawFreqs)] : ["monthly"];
        setPaymentFrequency(String(freqArray[0] ?? "monthly"));
        // Seed fee percent with the product's default (max of the range if available,
        // else the legacy single fee field). Rounded to whole numbers.
        const rawProcessingPct =
          apiProduct.max_processing_fee ?? apiProduct.processing_fee ?? product.processing_fee;
        const rawServicePct =
          apiProduct.max_service_fee ?? apiProduct.service_fee ?? product.service_fee;
        setProcessingFeeRate(
          rawProcessingPct != null ? String(Math.round(Number(rawProcessingPct))) : ""
        );
        setServiceFeeRate(
          rawServicePct != null ? String(Math.round(Number(rawServicePct))) : ""
        );
        // Seed SCB amount when the product requires it: default to the product's
        // minimum. The loan officer can adjust up to the product's maximum.
        if (product.scb_required) {
          setScbAmount(String(product.min_scb ?? ""));
        } else {
          setScbAmount("");
        }
      }
    },
    [products]
  );

  // ── Borrower Selection Handler ──
  const handleBorrowerChange = useCallback((id: number | null) => {
    setBorrowerId(id);
    setCoMakerIds([null]);
    // Collaterals are per-borrower — drop any selections from the previous
    // member so they don't get accidentally attached to the new loan.
    setSelectedCollaterals([]);
  }, []);

  // ── Co-Maker Slot Handlers ──
  function addCoMakerSlot() {
    setCoMakerIds((prev) => [...prev, null]);
  }

  function removeCoMakerSlot(index: number) {
    setCoMakerIds((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.length === 0 ? [null] : next;
    });
  }

  function setCoMakerAt(index: number, id: number | null) {
    setCoMakerIds((prev) => prev.map((v, i) => (i === index ? id : v)));
  }

  // ── Submit ──
  const canSubmit =
    borrowerId !== null &&
    productId !== null &&
    principal > 0 &&
    !principalError &&
    term > 0 &&
    !termError &&
    paymentFrequency !== null &&
    interestType !== null &&
    rate > 0 &&
    releaseDate !== undefined &&
    !scbError &&
    !processingFeePercentError &&
    !serviceFeePercentError;

  const handleSubmit = async () => {
    if (!canSubmit || !releaseDate) return;
    try {
      setSubmitting(true);
      const payload = {
        borrower_id: borrowerId,
        co_maker_ids: coMakerIds.filter((id): id is number => id !== null),
        loan_product_id: Number(productId),
        principal_amount: principal,
        // Loan terms chosen on the form. These were previously omitted from
        // the payload, so the backend fell back to product defaults (e.g. the
        // product's max term) — making the saved term/frequency/method, and
        // the backend-computed maturity date and total payable, differ from
        // what the user entered. The backend stores interest_method verbatim
        // ("straight"/"diminishing"), so send the form value as-is.
        term,
        frequency: paymentFrequency,
        interest_rate: rate,
        interest_method: interestType,
        start_date: formatDateISO(releaseDate),
        ...(scb > 0 && { scb_amount: scb }),
        ...(accountOfficerId && { account_officer_id: accountOfficerId }),
        ...(purpose.trim() && { purpose: purpose.trim() }),
        ...(policyException && {
          policy_exception: true,
          policy_exception_details: policyExceptionDetails.trim() || undefined,
        }),
      };

      // Edit mode — update existing loan, skip auto-submit (the loan is
      // already beyond draft and already in the approval chain).
      if (isEditMode && editLoanId) {
        const updated = await loanService.update(editLoanId, payload);

        if (policyException && policyExceptionLetter) {
          try {
            const letterData = new FormData();
            letterData.append("file", policyExceptionLetter);
            letterData.append("type", "policy_exception_letter");
            await api.upload(`/loans/${updated.id}/documents`, letterData);
          } catch {
            toast.warning("Loan updated but policy exception letter upload failed");
          }
        }

        // Reconcile collaterals: detach what's no longer selected, attach
        // the new picks. Snapshot value is captured at attach time so
        // post-edit ledger drift doesn't move security status silently.
        try {
          const existingLinks = await collateralService.listForLoan(
            updated.id,
          );
          const selectedIds = new Set(
            selectedCollaterals.map((s) => s.collateral.id),
          );
          await Promise.all(
            existingLinks
              .filter((l) => !selectedIds.has(l.collateral_id))
              .map((l) =>
                collateralService.detachFromLoan(updated.id, l.collateral_id),
              ),
          );
          await Promise.all(
            selectedCollaterals.map((s) =>
              collateralService.attachToLoan(
                updated.id,
                s.collateral.id,
                s.snapshot_value,
              ),
            ),
          );
        } catch {
          toast.warning("Loan updated but some collaterals failed to sync");
        }

        toast.success("Loan application updated");
        router.push(`/loans/${updated.id}`);
        return;
      }

      // Create mode
      const loan = await loanService.create(payload);

      // Attach selected collaterals. Snapshot value is captured here so
      // a future change to the underlying balance / amount does not retro-
      // actively change this loan's security status.
      if (selectedCollaterals.length > 0 && loan.id) {
        try {
          await Promise.all(
            selectedCollaterals.map((s) =>
              collateralService.attachToLoan(
                loan.id,
                s.collateral.id,
                s.snapshot_value,
              ),
            ),
          );
        } catch {
          toast.warning(
            "Loan created but some collaterals failed to attach — open the loan to retry.",
          );
        }
      }

      // Upload policy exception letter if provided
      if (policyException && policyExceptionLetter && loan.id) {
        try {
          const letterData = new FormData();
          letterData.append("file", policyExceptionLetter);
          letterData.append("type", "policy_exception_letter");
          letterData.append("label", policyExceptionLetter.name);
          await documentService.loanUpload(loan.id, letterData);
        } catch {
          toast.warning("Loan created but policy exception letter upload failed");
        }
      }

      // Auto-forward to Manager: creating the loan IS the Loan Processor's action,
      // so skip the redundant "Submit for Review" click on the detail page.
      let forwarded = false;
      try {
        await loanService.submit(loan.id);
        forwarded = true;
      } catch {
        toast.warning(
          "Loan created but could not be forwarded for review. Open the loan to submit it manually."
        );
      }

      toast.success("Loan Application Created", {
        description: forwarded
          ? "Forwarded to Manager for approval."
          : "Loan application has been created successfully.",
      });
      router.push(`/loans/${loan.id}`);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number; data?: { message?: string } } };
      if (axiosErr?.response?.status === 422) {
        toast.error(axiosErr.response.data?.message ?? "Validation error. Please check your inputs.");
      } else {
        toast.error(isEditMode ? "Failed to update loan application" : "Failed to create loan application");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingData) {
    return (
      <div className="flex min-h-[calc(100vh-6rem)] items-center justify-center">
        <Spinner className="size-6 text-muted-foreground" />
      </div>
    );
  }

  return (
    <RouteGuard
      permission={isEditMode ? "loans:update" : "loans:create"}
      pageName={isEditMode ? "Edit Loan Application" : "New Loan Application"}
    >
    <div className="mx-auto w-full max-w-4xl space-y-6 pb-10">
      {/* ── Header ── */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <Link
            href={isEditMode && editLoanId ? `/loans/${editLoanId}` : "/loans"}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-4" />
            {isEditMode ? "Back to Loan" : "Back to Loans"}
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">
            {isEditMode ? "Edit Loan Application" : "New Loan Application"}
          </h1>
          {isEditMode && existingLoan?.application_number && (
            <p className="text-sm text-muted-foreground font-mono">
              {existingLoan.application_number}
            </p>
          )}
        </div>
      </div>

      {/* ── Card 1: Borrower & Co-Maker ── */}
      <Card>
        <CardHeader>
          <CardTitle>Member & Co-Maker</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Borrower */}
            <div className="space-y-2">
              <div className="flex h-6 items-center">
                <Label>
                  Member <span className="text-destructive">*</span>
                </Label>
              </div>
              <Popover open={borrowerOpen} onOpenChange={setBorrowerOpen}>
                <PopoverTrigger
                  render={
                    <button
                      type="button"
                      role="combobox"
                      aria-expanded={borrowerOpen}
                      className="flex h-8 w-full items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-2.5 text-sm transition-colors hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                    />
                  }
                >
                  <span className={cn("truncate", !selectedBorrower && "text-muted-foreground")}>
                    {selectedBorrower
                      ? selectedBorrower.full_name
                      : "Search member..."}
                  </span>
                  <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
                </PopoverTrigger>
                <PopoverContent className="w-(--anchor-width) p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Type a name to search..." />
                    <CommandList>
                      <CommandEmpty>No member found.</CommandEmpty>
                      <CommandGroup>
                        {borrowers.map((b) => (
                          <CommandItem
                            key={b.id}
                            value={`${b.full_name} ${b.borrower_code}`}
                            onSelect={() => {
                              handleBorrowerChange(
                                b.id === borrowerId ? null : b.id
                              );
                              setBorrowerOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 size-4",
                                borrowerId === b.id
                                  ? "opacity-100"
                                  : "opacity-0"
                              )}
                            />
                            {b.full_name}{" "}
                            <span className="text-muted-foreground">
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

            {/* Co-Makers */}
            <div className="space-y-2">
              <div className="flex h-6 items-center justify-between">
                <Label>Co-Maker{coMakerIds.length > 1 ? "s" : ""}</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 gap-1 px-2 text-xs text-brand-orange hover:text-brand-orange hover:bg-brand-orange/10"
                  onClick={addCoMakerSlot}
                >
                  <Plus className="h-3 w-3" />
                  Add Co-Maker
                </Button>
              </div>
              <div className="space-y-2">
                {coMakerIds.map((selectedId, index) => {
                  const options = availableCoMakersFor(index);
                  const selected = selectedId ? borrowers.find((b) => b.id === selectedId) : null;
                  const isOpen = openCoMakerIndex === index;
                  return (
                    <div key={index} className="flex items-center gap-2">
                      <Popover
                        open={isOpen}
                        onOpenChange={(o) => setOpenCoMakerIndex(o ? index : null)}
                      >
                        <PopoverTrigger
                          render={
                            <button
                              type="button"
                              role="combobox"
                              aria-expanded={isOpen}
                              disabled={options.length === 0}
                              className="flex h-8 w-full items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-2.5 text-sm transition-colors hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
                            />
                          }
                        >
                          <span className={cn("truncate", !selectedId && "text-muted-foreground")}>
                            {selected
                              ? (selected.full_name ?? `${selected.first_name} ${selected.last_name}`)
                              : options.length === 0
                                ? "No members available"
                                : "Search co-maker (optional)..."}
                          </span>
                          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
                        </PopoverTrigger>
                        <PopoverContent className="w-(--anchor-width) p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Type a name to search..." />
                            <CommandList>
                              <CommandEmpty>No members found.</CommandEmpty>
                              <CommandGroup>
                                {options.map((b) => (
                                  <CommandItem
                                    key={b.id}
                                    value={b.full_name ?? `${b.first_name} ${b.last_name}`}
                                    onSelect={() => {
                                      setCoMakerAt(index, b.id === selectedId ? null : b.id);
                                      setOpenCoMakerIndex(null);
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 size-4",
                                        selectedId === b.id ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    {b.full_name ?? `${b.first_name} ${b.last_name}`}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      {coMakerIds.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={() => removeCoMakerSlot(index)}
                          title="Remove co-maker"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Account Officer */}
          <div className="space-y-2">
            <Label>Account Officer (AO)</Label>
            <Popover open={aoOpen} onOpenChange={setAoOpen}>
              <PopoverTrigger
                render={
                  <button
                    type="button"
                    role="combobox"
                    aria-expanded={aoOpen}
                    className="flex h-8 w-full items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-2.5 text-sm transition-colors hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                  />
                }
              >
                <span className={cn("truncate", !accountOfficerId && "text-muted-foreground")}>
                  {accountOfficerId
                    ? users.find((u) => u.id === accountOfficerId)?.full_name ?? "Select AO"
                    : "Select account officer"}
                </span>
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
                            setAccountOfficerId(user.id);
                            setAoOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 size-4",
                              accountOfficerId === user.id ? "opacity-100" : "opacity-0"
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
          </div>

          {/* Purpose */}
          <div className="space-y-2">
            <Label>Purpose</Label>
            <Textarea
              placeholder="Briefly describe the purpose of this loan"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              className="min-h-20"
            />
          </div>

          <Separator />

          {/* Policy Exception */}
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <Checkbox
                id="policy-exception"
                checked={policyException}
                onCheckedChange={(checked) => {
                  setPolicyException(checked === true);
                  if (!checked) {
                    setPolicyExceptionDetails("");
                    setPolicyExceptionLetter(null);
                  }
                }}
              />
              <div>
                <Label htmlFor="policy-exception" className="cursor-pointer font-medium">
                  Policy Exception
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Check this if the loan requires policy exception approval (full BOD review)
                </p>
              </div>
            </div>

            {policyException && (
              <div className="space-y-4 rounded-lg border border-amber-300 bg-amber-50/50 dark:border-amber-700 dark:bg-amber-900/10 p-4">
                {/* Policy Exception Details */}
                <div className="space-y-2">
                  <Label htmlFor="pe-details">Policy Exception Details</Label>
                  <Textarea
                    id="pe-details"
                    placeholder="Describe why this loan requires a policy exception..."
                    value={policyExceptionDetails}
                    onChange={(e) => setPolicyExceptionDetails(e.target.value)}
                    className="min-h-20"
                  />
                </div>

                {/* Policy Exception Letter Upload */}
                <div className="space-y-2">
                  <Label>Policy Exception Letter</Label>
                  {policyExceptionLetter ? (
                    <div className="flex items-center gap-3 rounded-lg border p-3 bg-background">
                      <FileText className="h-5 w-5 text-brand-orange shrink-0" />
                      <span className="text-sm truncate flex-1">{policyExceptionLetter.name}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setPolicyExceptionLetter(null)}
                        className="text-destructive hover:text-destructive shrink-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <label className="flex items-center gap-3 cursor-pointer rounded-lg border border-dashed border-muted-foreground/30 px-4 py-3 hover:border-brand-orange/50 hover:bg-brand-orange/5 transition-colors">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Click to upload policy exception letter</p>
                        <p className="text-xs text-muted-foreground/70">PDF, DOC, or image file</p>
                      </div>
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx,image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) setPolicyExceptionLetter(file);
                        }}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Card 2: Loan Product & Terms ── */}
      <Card>
        <CardHeader>
          <CardTitle>Loan Product & Terms</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Product */}
          <div className="space-y-2">
            <Label>
              Loan Product <span className="text-destructive">*</span>
            </Label>
            <Select
              value={productId ?? null}
              onValueChange={(value) => handleProductChange(value)}
              items={products.map((p) => ({ value: String(p.id), label: p.name }))}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a loan product" />
              </SelectTrigger>
              <SelectContent>
                {products.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.name}
                    {p.description && (
                      <span className="text-muted-foreground">
                        {" "}
                        — {p.description}
                      </span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedProduct && (
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <Info className="size-3" />
                Amount: {formatCurrency(selectedProduct.min_amount)} –{" "}
                {formatCurrency(selectedProduct.max_amount)} | Term:{" "}
                {selectedProduct.min_term} – {selectedProduct.max_term} months
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Principal Amount */}
            <div className="space-y-2">
              <Label>
                Loan Amount <span className="text-destructive">*</span>
              </Label>
              <Input
                type="number"
                placeholder="0"
                step="1"
                value={principalAmount}
                onChange={(e) => setPrincipalAmount(e.target.value.replace(/\D/g, ""))}
                min={selectedProduct?.min_amount}
                max={selectedProduct?.max_amount}
              />
              {principalError && (
                <p className="text-xs text-destructive">{principalError}</p>
              )}
            </div>

            {/* Term */}
            <div className="space-y-2">
              <Label>
                Term (months) <span className="text-destructive">*</span>
              </Label>
              <Input
                type="number"
                placeholder="0"
                step="1"
                value={termMonths}
                onChange={(e) => setTermMonths(e.target.value.replace(/\D/g, ""))}
                min={selectedProduct?.min_term}
                max={selectedProduct?.max_term}
              />
              {termError && (
                <p className="text-xs text-destructive">{termError}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {/* Payment Frequency */}
            <div className="space-y-2">
              <Label>Payment Frequency</Label>
              <Select
                value={paymentFrequency ?? null}
                onValueChange={(value) => setPaymentFrequency(value ?? null)}
                disabled={productFrequencies.length === 1}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select frequency">
                    {(value: string | null) =>
                      value ? (PAYMENT_FREQUENCY_LABELS[value] ?? value) : "Select frequency"
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {(productFrequencies.length > 0
                    ? PAYMENT_FREQUENCY_OPTIONS.filter((o) => productFrequencies.includes(o.value))
                    : PAYMENT_FREQUENCY_OPTIONS
                  ).map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {productFrequencies.length === 1 && (
                <p className="text-xs text-muted-foreground">Set by loan product</p>
              )}
            </div>

            {/* Interest Rate */}
            <div className="space-y-2">
              <Label>Interest Rate (%)</Label>
              <Input
                type="number"
                placeholder="0"
                step="1"
                min={0}
                value={interestRate}
                onChange={(e) => {
                  // Accept digits only — keep the value a whole number
                  const v = e.target.value.replace(/\D/g, "");
                  setInterestRate(v);
                }}
              />
            </div>

            {/* Interest Type */}
            <div className="space-y-2">
              <Label>Interest Type</Label>
              <Select
                value={interestType ?? null}
                onValueChange={(value) => setInterestType(value ?? null)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select type">
                    {(value: string | null) =>
                      value
                        ? (INTEREST_TYPE_OPTIONS.find((o) => o.value === value)?.label ?? value)
                        : "Select type"
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {INTEREST_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Share Capital Build-Up — always visible when a product is
              selected. Required when product has scb_required; optional
              otherwise. This ensures the tester / user can always enter an
              SCB amount regardless of backend product config. */}
          {selectedProduct && (
            <div className="mt-4 rounded-lg border border-brand-orange/30 bg-brand-orange/5 p-4 space-y-3">
              <div className="space-y-0.5">
                <Label htmlFor="scb-amount" className="text-sm font-medium">
                  Share Capital Build-Up{" "}
                  {selectedProduct.scb_required ? (
                    <span className="text-destructive">*</span>
                  ) : (
                    <span className="text-muted-foreground font-normal">(optional)</span>
                  )}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {selectedProduct.scb_required
                    ? "This product requires a Share Capital Build-Up amount per period."
                    : "Enter an amount to add Share Capital Build-Up to each amortization period."}{" "}
                  The SCB portion will be credited to the member&rsquo;s share
                  capital each time they pay.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Input
                    id="scb-amount"
                    type="number"
                    min={selectedProduct.min_scb ?? 0}
                    max={selectedProduct.max_scb ?? undefined}
                    step="1"
                    placeholder="0"
                    value={scbAmount}
                    onChange={(e) => setScbAmount(e.target.value)}
                  />
                  {scbError && (
                    <p className="text-xs text-destructive">{scbError}</p>
                  )}
                </div>
                {selectedProduct.scb_required && (selectedProduct.min_scb ?? 0) > 0 && (
                  <div className="flex items-center text-xs text-muted-foreground">
                    Allowed range:{" "}
                    <span className="ml-1 font-medium text-foreground">
                      {formatCurrency(selectedProduct.min_scb ?? 0)} –{" "}
                      {formatCurrency(selectedProduct.max_scb ?? 0)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Card 3: Collaterals ── */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="size-5 text-brand-blue" />
                Collaterals
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Attach the member&rsquo;s registered collaterals to secure
                this loan. Only collaterals not currently locked to another
                active loan can be selected.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCollateralPickerOpen(true)}
              disabled={borrowerId === null}
            >
              <Plus className="mr-2 size-4" />
              Add Collateral
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {borrowerId === null ? (
            <p className="text-sm text-muted-foreground">
              Pick a member first to load their registered collaterals.
            </p>
          ) : selectedCollaterals.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center">
              <ShieldCheck className="mx-auto size-8 text-muted-foreground/50" />
              <p className="mt-2 text-sm font-medium text-muted-foreground">
                No collaterals attached
              </p>
              <p className="mt-1 text-xs text-muted-foreground/80">
                {availableCollaterals.length === 0
                  ? "This member has no registered collaterals yet."
                  : "Click “Add Collateral” to attach one."}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {selectedCollaterals.map(({ collateral: c, snapshot_value }) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between gap-3 rounded-lg border bg-muted/20 px-3 py-2"
                >
                  <div className="flex flex-1 flex-wrap items-center gap-2">
                    <Badge variant="secondary">
                      {c.type?.name ?? "Unknown"}
                    </Badge>
                    <span className="text-sm font-medium">
                      {c.detail_value}
                    </span>
                    {c.type?.source === "share_capital" && (
                      <span className="text-xs text-muted-foreground">
                        (auto-derived)
                      </span>
                    )}
                  </div>
                  <span className="text-sm font-semibold tabular-nums">
                    {formatCurrency(snapshot_value)}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() =>
                      setSelectedCollaterals((prev) =>
                        prev.filter((s) => s.collateral.id !== c.id),
                      )
                    }
                    aria-label="Remove collateral"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {selectedCollaterals.length > 0 && (
            <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs text-muted-foreground">
                  Total Collateral Value
                </p>
                <p className="text-lg font-bold tabular-nums">
                  {formatCurrency(totalCollateralValue)}
                </p>
              </div>
              <div className="flex flex-col items-start gap-1 sm:items-end">
                <Badge
                  className={cn(
                    securityStatus === "secured" &&
                      "bg-green-500/15 text-green-700 hover:bg-green-500/15",
                    securityStatus === "partially_secured" &&
                      "bg-amber-500/15 text-amber-700 hover:bg-amber-500/15",
                    securityStatus === "unsecured" &&
                      "bg-destructive/15 text-destructive hover:bg-destructive/15",
                  )}
                >
                  {securityStatusLabel(securityStatus)}
                </Badge>
                {principal > 0 && securityStatus !== "secured" && (
                  <p className="text-xs text-muted-foreground">
                    Short by{" "}
                    <span className="font-medium text-foreground">
                      {formatCurrency(
                        Math.max(0, principal - totalCollateralValue),
                      )}
                    </span>{" "}
                    vs. principal
                  </p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Card 4: Dates ── */}
      <Card>
        <CardHeader>
          <CardTitle>Dates</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Release Date */}
            <div className="space-y-2">
              <Label>
                Release Date <span className="text-destructive">*</span>
              </Label>
              <Popover open={releaseDateOpen} onOpenChange={setReleaseDateOpen}>
                <PopoverTrigger
                  render={
                    <button
                      type="button"
                      className="flex h-8 w-full items-center gap-2 rounded-lg border border-input bg-transparent px-2.5 text-sm transition-colors hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                    />
                  }
                >
                  <CalendarIcon className="size-4 text-muted-foreground" />
                  {releaseDate ? (
                    <span>{formatDate(releaseDate)}</span>
                  ) : (
                    <span className="text-muted-foreground">Pick a date</span>
                  )}
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={releaseDate}
                    onSelect={(date) => {
                      setReleaseDate(date ?? undefined);
                      setReleaseDateOpen(false);
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Maturity Date */}
            <div className="space-y-2">
              <Label>Maturity Date</Label>
              <div className="flex h-8 items-center rounded-lg border border-input bg-muted/30 px-2.5 text-sm text-muted-foreground">
                {maturityDate ? formatDate(maturityDate) : "Auto-computed"}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Card 4: Deductions & Net Proceeds ── */}
      <Card>
        <CardHeader>
          <CardTitle>Deductions & Net Proceeds</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {/* Processing Fee */}
            <div className="space-y-2">
              <Label className="flex items-center gap-0.5">
                Processing Fee
                <span className="text-muted-foreground font-normal text-xs ml-0.5">(</span>
                {editingFeeRate === "processing" ? (
                  <input
                    type="number"
                    min={processingFeeRange.min || 0}
                    max={processingFeeRange.max || 100}
                    step="1"
                    autoFocus
                    className="w-10 border-b border-brand-orange bg-transparent text-center text-xs text-muted-foreground font-normal outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    value={processingFeeRate}
                    onChange={(e) => setProcessingFeeRate(e.target.value.replace(/\D/g, "").slice(0, 3))}
                    onBlur={() => setEditingFeeRate(null)}
                    onKeyDown={(e) => { if (e.key === "Enter") setEditingFeeRate(null); }}
                  />
                ) : (
                  <span
                    className="text-xs text-muted-foreground font-normal cursor-pointer hover:text-brand-orange"
                    onClick={() => setEditingFeeRate("processing")}
                    title="Click to edit"
                  >
                    {processingFeeRate ? Math.round(Number(processingFeeRate)) : "0"}
                  </span>
                )}
                <span className="text-muted-foreground font-normal text-xs">%)</span>
              </Label>
              <Input
                type="text"
                readOnly
                value={formatCurrency(processingFee)}
                className="bg-muted/40 cursor-default font-medium tabular-nums"
              />
              {processingFeeRange.max > 0 && (
                <p className="text-[10px] text-muted-foreground">
                  Allowed range: {processingFeeRange.min}% – {processingFeeRange.max}%
                </p>
              )}
              {processingFeePercentError && (
                <p className="text-[10px] text-destructive">{processingFeePercentError}</p>
              )}
            </div>

            {/* Service Fee */}
            <div className="space-y-2">
              <Label className="flex items-center gap-0.5">
                Service Fee
                <span className="text-muted-foreground font-normal text-xs ml-0.5">(</span>
                {editingFeeRate === "service" ? (
                  <input
                    type="number"
                    min={serviceFeeRange.min || 0}
                    max={serviceFeeRange.max || 100}
                    step="1"
                    autoFocus
                    className="w-10 border-b border-brand-orange bg-transparent text-center text-xs text-muted-foreground font-normal outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    value={serviceFeeRate}
                    onChange={(e) => setServiceFeeRate(e.target.value.replace(/\D/g, "").slice(0, 3))}
                    onBlur={() => setEditingFeeRate(null)}
                    onKeyDown={(e) => { if (e.key === "Enter") setEditingFeeRate(null); }}
                  />
                ) : (
                  <span
                    className="text-xs text-muted-foreground font-normal cursor-pointer hover:text-brand-orange"
                    onClick={() => setEditingFeeRate("service")}
                    title="Click to edit"
                  >
                    {serviceFeeRate ? Math.round(Number(serviceFeeRate)) : "0"}
                  </span>
                )}
                <span className="text-muted-foreground font-normal text-xs">%)</span>
              </Label>
              <Input
                type="text"
                readOnly
                value={formatCurrency(serviceFee)}
                className="bg-muted/40 cursor-default font-medium tabular-nums"
              />
              {serviceFeeRange.max > 0 && (
                <p className="text-[10px] text-muted-foreground">
                  Allowed range: {serviceFeeRange.min}% – {serviceFeeRange.max}%
                </p>
              )}
              {serviceFeePercentError && (
                <p className="text-[10px] text-destructive">{serviceFeePercentError}</p>
              )}
            </div>

          </div>

            {/* Other Deductions */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Other Deductions</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setOtherDeductions((prev) => [...prev, { name: "", amount: "" }])}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add Deduction
                </Button>
              </div>
              {otherDeductions.length === 0 ? (
                <p className="text-xs text-muted-foreground">No other deductions added.</p>
              ) : (
                <div className="space-y-2">
                  {otherDeductions.map((ded, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Input
                        placeholder="Deduction name"
                        value={ded.name}
                        onChange={(e) =>
                          setOtherDeductions((prev) =>
                            prev.map((d, i) => (i === idx ? { ...d, name: e.target.value } : d))
                          )
                        }
                        className="flex-1"
                      />
                      <Input
                        type="number"
                        placeholder="Amount"
                        min={0}
                        step="1"
                        value={ded.amount}
                        onChange={(e) =>
                          setOtherDeductions((prev) =>
                            prev.map((d, i) => (i === idx ? { ...d, amount: e.target.value.replace(/\D/g, "") } : d))
                          )
                        }
                        className="w-32"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setOtherDeductions((prev) => prev.filter((_, i) => i !== idx))}
                        className="text-destructive hover:text-destructive shrink-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

          <Separator />

          {/* Summary */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3">
              <span className="text-sm text-muted-foreground">
                Total Deductions
              </span>
              <span className="text-sm font-semibold">
                {formatCurrency(totalDeductions)}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-brand-orange/10 px-4 py-3">
              <span className="text-sm font-medium">Net Proceeds</span>
              <span className="text-lg font-bold text-brand-orange">
                {formatCurrency(netProceeds)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Card 5: Amortization Schedule Preview ── */}
      <Card>
        <CardHeader>
          <CardTitle>Amortization Schedule Preview</CardTitle>
        </CardHeader>
        <CardContent>
          {canShowAmortization && amortizationSchedule.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12 text-center">#</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead className="text-right">Principal</TableHead>
                    <TableHead className="text-right">Interest</TableHead>
                                        <TableHead className="text-right">Share Capital Build-Up</TableHead>
                    <TableHead className="text-right">Total Payment</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {amortizationSchedule.map((row) => (
                    <TableRow key={row.period}>
                      <TableCell className="text-center">
                        {row.period}
                      </TableCell>
                      <TableCell>{formatDate(row.dueDate)}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(row.principal)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(row.interest)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(row.shareCapitalBuildUp)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(row.totalPayment)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={2} className="font-semibold">
                      Total
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(amortizationTotals.principal)}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(amortizationTotals.interest)}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(amortizationTotals.shareCapitalBuildUp)}
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      {formatCurrency(amortizationTotals.totalPayment)}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
              <Info className="mb-2 size-8 opacity-50" />
              <p className="text-sm">
                Fill in all required fields above to preview the amortization
                schedule.
              </p>
              <p className="mt-1 text-xs">
                Product, amount, term, interest, frequency, and release date are
                required.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Submit ── */}
      <div className="flex justify-end">
        <Button
          size="lg"
          className="w-full bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark sm:w-auto"
          disabled={!canSubmit || submitting}
          onClick={handleSubmit}
        >
          {submitting
            ? isEditMode ? "Saving..." : "Submitting..."
            : isEditMode ? "Save Changes" : "Submit Loan Application"}
        </Button>
      </div>

      {/* ── Collateral Picker Dialog ── */}
      <Dialog
        open={collateralPickerOpen}
        onOpenChange={setCollateralPickerOpen}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Attach Collateral</DialogTitle>
            <DialogDescription>
              Pick from the registered collaterals for{" "}
              <span className="font-medium">
                {selectedBorrower?.full_name ?? "this member"}
              </span>
              . Collaterals already locked to another active loan are
              disabled. Need a new one?{" "}
              <Link
                href={`/collaterals/new${
                  borrowerId ? `?borrower_id=${borrowerId}` : ""
                }`}
                className="text-primary underline"
              >
                Register a collateral
              </Link>
              .
            </DialogDescription>
          </DialogHeader>
          {pickerRows.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center">
              <p className="text-sm text-muted-foreground">
                This member hasn&rsquo;t registered any collaterals yet.
              </p>
            </div>
          ) : (
            <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
              {pickerRows.map(({ collateral: c, isSelected, isLocked }) => (
                <button
                  key={c.id}
                  type="button"
                  disabled={isSelected || isLocked}
                  onClick={() => {
                    setSelectedCollaterals((prev) => [
                      ...prev,
                      {
                        collateral: c,
                        snapshot_value: c.effective_value,
                      },
                    ]);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left transition-colors",
                    !isSelected &&
                      !isLocked &&
                      "hover:border-primary/40 hover:bg-muted/40",
                    (isSelected || isLocked) && "opacity-60",
                  )}
                >
                  <div className="flex flex-1 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">
                        {c.type?.name ?? "Unknown"}
                      </Badge>
                      <span className="text-sm font-medium">
                        {c.detail_value}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {isLocked && (
                        <Badge className="bg-amber-500/15 text-amber-700 hover:bg-amber-500/15">
                          Tagged to loan{" "}
                          {c.active_loan_account_number ??
                            `#${c.active_loan_id}`}
                        </Badge>
                      )}
                      {isSelected && !isLocked && (
                        <Badge variant="outline">Already attached</Badge>
                      )}
                      {c.type?.source === "share_capital" && (
                        <span>Live share-capital balance</span>
                      )}
                    </div>
                  </div>
                  <span className="text-sm font-semibold tabular-nums">
                    {formatCurrency(c.effective_value)}
                  </span>
                </button>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCollateralPickerOpen(false)}
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
    </RouteGuard>
  );
}

export default function NewLoanApplicationPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[calc(100vh-6rem)] items-center justify-center">
          <Spinner className="size-6 text-muted-foreground" />
        </div>
      }
    >
      <NewLoanApplicationInner />
    </Suspense>
  );
}
