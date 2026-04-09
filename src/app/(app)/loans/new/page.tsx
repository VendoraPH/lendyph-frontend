"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { RouteGuard } from "@/components/common";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, CalendarIcon, Info, ChevronsUpDown, Check, Plus, X } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { borrowerService, coMakerService, loanProductService, loanService, userService } from "@/services";
import type { Borrower, CoMaker, User } from "@/types";

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
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(amount));

// ── Helpers ──

type PaymentFrequency = "daily" | "weekly" | "bi_weekly" | "semi_monthly" | "monthly";
type InterestType = "straight" | "fixed" | "diminishing" | "upon_maturity";

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
  const totalPeriods = getPeriodsFromMonths(termMonths, frequency);
  const intervalDays = getIntervalDays(frequency);
  const r = interestRate / 100;
  const rows: AmortizationRow[] = [];
  let remainingBalance = principal;
  const scb = Math.round(scbAmount);

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

  // Upon Maturity: interest-only payments, full principal at the end
  else if (interestType === "upon_maturity") {
    const interestPerPeriod = Math.round(principal * r);

    for (let i = 1; i <= totalPeriods; i++) {
      const dueDate = frequency === "monthly"
        ? addMonths(releaseDate, i)
        : addDays(releaseDate, i * intervalDays);
      const isLast = i === totalPeriods;
      const periodPrincipal = isLast ? principal : 0;

      rows.push({
        period: i,
        dueDate,
        principal: periodPrincipal,
        interest: interestPerPeriod,
        shareCapitalBuildUp: scb,
        totalPayment: periodPrincipal + interestPerPeriod + scb,
      });
    }
  }

  return rows;
}

// ── Main Page Component ──

export default function NewLoanApplicationPage() {
  const router = useRouter();

  // ── API Data ──
  const [borrowers, setBorrowers] = useState<Borrower[]>([]);
  const [products, setProducts] = useState<LoanProduct[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [submitting, setSubmitting] = useState(false);

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

  // ── Fetch borrowers and products on mount ──
  useEffect(() => {
    async function fetchData() {
      setLoadingData(true);

      const [borrowersResult, productsResult, usersResult] = await Promise.allSettled([
        borrowerService.list({ per_page: 200 }),
        loanProductService.list(),
        userService.list(),
      ]);

      if (borrowersResult.status === "fulfilled") {
        const borrowerData = Array.isArray(borrowersResult.value)
          ? borrowersResult.value
          : (borrowersResult.value as { data: Borrower[] }).data ?? [];
        setBorrowers(borrowerData);
      } else {
        toast.error("Failed to load members");
      }

      if (productsResult.status === "fulfilled") {
        setProducts(
          Array.isArray(productsResult.value)
            ? productsResult.value
            : (productsResult.value as unknown as { data: LoanProduct[] }).data ?? []
        );
      } else {
        toast.error("Failed to load loan products");
      }

      if (usersResult.status === "fulfilled") {
        const userData = Array.isArray(usersResult.value)
          ? usersResult.value
          : (usersResult.value as unknown as { data: User[] }).data ?? [];
        setUsers(userData.filter((u) => u.status === "active"));
      }

      setLoadingData(false);
    }
    fetchData();
  }, []);

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

  // SCB validation — only when the product requires it
  const scbError = useMemo(() => {
    if (!selectedProduct?.scb_required) return null;
    if (!scbAmount) return "Share Capital Build-Up amount is required";
    const min = selectedProduct.min_scb ?? 0;
    const max = selectedProduct.max_scb ?? 0;
    if (scb < min) return `Minimum SCB is ${formatCurrency(min)}`;
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

  // ── Product Selection Handler ──
  const handleProductChange = useCallback(
    (value: string | null) => {
      setProductId(value);
      const product = products.find((p) => p.id === Number(value));
      if (product) {
        const apiProduct = product as unknown as Record<string, unknown>;
        setInterestRate(
          product.interest_rate != null
            ? String(Math.round(Number(product.interest_rate)))
            : ""
        );
        // Map API field names: interest_method/interest_type, "fixed" -> "straight"
        const rawType = String(apiProduct.interest_method ?? product.interest_type ?? "straight");
        setInterestType(rawType === "fixed" ? "straight" : rawType);
        // Map API field names: frequency/payment_frequency
        setPaymentFrequency(String(apiProduct.frequency ?? product.payment_frequency ?? "monthly"));
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
        interest_rate: rate,
        start_date: formatDateISO(releaseDate),
        ...(selectedProduct?.scb_required && scb > 0 && { scb_amount: scb }),
        ...(accountOfficerId && { account_officer_id: accountOfficerId }),
        ...(purpose.trim() && { purpose: purpose.trim() }),
      };
      const loan = await loanService.create(payload);
      toast.success("Loan Application Created", {
        description: `Loan application has been created successfully.`,
      });
      router.push(`/loans/${loan.id}`);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number; data?: { message?: string } } };
      if (axiosErr?.response?.status === 422) {
        toast.error(axiosErr.response.data?.message ?? "Validation error. Please check your inputs.");
      } else {
        toast.error("Failed to create loan application");
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
    <RouteGuard permission="loans:create" pageName="New Loan Application">
    <div className="mx-auto w-full max-w-4xl space-y-6 pb-10">
      {/* ── Header ── */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <Link
            href="/loans"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-4" />
            Back to Loans
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">
            New Loan Application
          </h1>
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
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select frequency">
                    {(value: string | null) =>
                      value ? (PAYMENT_FREQUENCY_LABELS[value] ?? value) : "Select frequency"
                    }
                  </SelectValue>
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

          {/* Share Capital Build-Up — only when the selected product requires it */}
          {selectedProduct?.scb_required && (
            <div className="mt-4 rounded-lg border border-brand-orange/30 bg-brand-orange/5 p-4 space-y-3">
              <div className="space-y-0.5">
                <Label htmlFor="scb-amount" className="text-sm font-medium">
                  Share Capital Build-Up{" "}
                  <span className="text-destructive">*</span>
                </Label>
                <p className="text-xs text-muted-foreground">
                  This product requires a Share Capital Build-Up amount per
                  period. It will be credited to the member&rsquo;s share
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
                    placeholder={
                      selectedProduct.min_scb != null
                        ? String(selectedProduct.min_scb)
                        : "0"
                    }
                    value={scbAmount}
                    onChange={(e) => setScbAmount(e.target.value)}
                  />
                  {scbError && (
                    <p className="text-xs text-destructive">{scbError}</p>
                  )}
                </div>
                <div className="flex items-center text-xs text-muted-foreground">
                  Allowed range:{" "}
                  <span className="ml-1 font-medium text-foreground">
                    {formatCurrency(selectedProduct.min_scb ?? 0)} –{" "}
                    {formatCurrency(selectedProduct.max_scb ?? 0)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Card 3: Dates ── */}
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
                    {selectedProduct?.scb_required && (
                      <TableHead className="text-right">Share Capital Build-Up</TableHead>
                    )}
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
                      {selectedProduct?.scb_required && (
                        <TableCell className="text-right text-brand-orange">
                          {formatCurrency(row.shareCapitalBuildUp)}
                        </TableCell>
                      )}
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
                    {selectedProduct?.scb_required && (
                      <TableCell className="text-right font-semibold text-brand-orange">
                        {formatCurrency(amortizationTotals.shareCapitalBuildUp)}
                      </TableCell>
                    )}
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
          {submitting ? "Submitting..." : "Submit Loan Application"}
        </Button>
      </div>

    </div>
    </RouteGuard>
  );
}
