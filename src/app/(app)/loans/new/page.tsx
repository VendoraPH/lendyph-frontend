"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { RouteGuard } from "@/components/common";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, CalendarIcon, Info, ChevronsUpDown, Check } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { borrowerService, coMakerService, loanProductService, loanService } from "@/services";
import type { Borrower, CoMaker } from "@/types";

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
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(
    amount
  );

// ── Helpers ──

type PaymentFrequency = "daily" | "weekly" | "bi_weekly" | "monthly";
type InterestType = "fixed" | "diminishing" | "upon_maturity";

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
  totalPayment: number;
}

function computeAmortization(
  principal: number,
  interestRate: number,
  interestType: InterestType,
  termMonths: number,
  frequency: PaymentFrequency,
  releaseDate: Date
): AmortizationRow[] {
  const totalPeriods = getPeriodsFromMonths(termMonths, frequency);
  const intervalDays = getIntervalDays(frequency);
  const principalPerPeriod = principal / totalPeriods;
  const rows: AmortizationRow[] = [];

  let remainingBalance = principal;

  for (let i = 1; i <= totalPeriods; i++) {
    const dueDate =
      frequency === "monthly"
        ? addMonths(releaseDate, i)
        : addDays(releaseDate, i * intervalDays);

    let interest: number;
    if (interestType === "fixed") {
      interest = principal * (interestRate / 100);
    } else {
      interest = remainingBalance * (interestRate / 100);
    }

    rows.push({
      period: i,
      dueDate,
      principal: principalPerPeriod,
      interest,
      totalPayment: principalPerPeriod + interest,
    });

    remainingBalance -= principalPerPeriod;
  }

  return rows;
}

// ── Main Page Component ──

export default function NewLoanApplicationPage() {
  const router = useRouter();

  // ── API Data ──
  const [borrowers, setBorrowers] = useState<Borrower[]>([]);
  const [coMakers, setCoMakers] = useState<CoMaker[]>([]);
  const [products, setProducts] = useState<LoanProduct[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // ── Borrower & Co-Maker State ──
  const [borrowerId, setBorrowerId] = useState<number | null>(null);
  const [coMakerId, setCoMakerId] = useState<number | null>(null);
  const [purpose, setPurpose] = useState("");

  // ── Loan Product & Terms State ──
  const [productId, setProductId] = useState<string | null>(null);
  const [principalAmount, setPrincipalAmount] = useState<string>("");
  const [termMonths, setTermMonths] = useState<string>("");
  const [paymentFrequency, setPaymentFrequency] = useState<string | null>(null);
  const [interestRate, setInterestRate] = useState<string>("");
  const [interestType, setInterestType] = useState<string | null>(null);

  // ── Combobox Open State ──
  const [borrowerOpen, setBorrowerOpen] = useState(false);
  const [coMakerOpen, setCoMakerOpen] = useState(false);

  // ── Dates State ──
  const [releaseDate, setReleaseDate] = useState<Date | undefined>(undefined);
  const [releaseDateOpen, setReleaseDateOpen] = useState(false);

  // ── Deductions State ──
  const [processingFeeOverride, setProcessingFeeOverride] = useState<
    string | null
  >(null);
  const [serviceFeeOverride, setServiceFeeOverride] = useState<string | null>(
    null
  );
  const [otherDeductions, setOtherDeductions] = useState<string>("0");

  // ── Fetch borrowers and products on mount ──
  useEffect(() => {
    async function fetchData() {
      setLoadingData(true);

      const [borrowersResult, productsResult] = await Promise.allSettled([
        borrowerService.list({ per_page: 200 }),
        loanProductService.list(),
      ]);

      if (borrowersResult.status === "fulfilled") {
        const borrowerData = Array.isArray(borrowersResult.value)
          ? borrowersResult.value
          : (borrowersResult.value as { data: Borrower[] }).data ?? [];
        setBorrowers(borrowerData);
      } else {
        toast.error("Failed to load borrowers");
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

      setLoadingData(false);
    }
    fetchData();
  }, []);

  // ── Fetch co-makers when borrower changes ──
  useEffect(() => {
    if (!borrowerId) {
      setCoMakers([]);
      return;
    }
    async function fetchCoMakers() {
      try {
        const res = await coMakerService.list(borrowerId!);
        setCoMakers(Array.isArray(res) ? res : []);
      } catch {
        setCoMakers([]);
      }
    }
    fetchCoMakers();
  }, [borrowerId]);

  // ── Derived ──
  const selectedBorrower = useMemo(
    () => borrowers.find((b) => b.id === borrowerId) ?? null,
    [borrowerId, borrowers]
  );
  const selectedCoMaker = useMemo(
    () => coMakers.find((cm) => cm.id === coMakerId) ?? null,
    [coMakerId, coMakers]
  );
  const selectedProduct = useMemo(
    () => (productId ? products.find((p) => p.id === Number(productId)) ?? null : null),
    [productId, products]
  );

  const principal = parseFloat(principalAmount) || 0;
  const term = parseInt(termMonths) || 0;
  const rate = parseFloat(interestRate) || 0;

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

  // Fees
  const processingFee =
    processingFeeOverride !== null
      ? parseFloat(processingFeeOverride) || 0
      : selectedProduct
        ? principal * (selectedProduct.processing_fee / 100)
        : 0;

  const serviceFee =
    serviceFeeOverride !== null
      ? parseFloat(serviceFeeOverride) || 0
      : selectedProduct
        ? principal * (selectedProduct.service_fee / 100)
        : 0;

  const otherDed = parseFloat(otherDeductions) || 0;
  const totalDeductions = processingFee + serviceFee + otherDed;
  const netProceeds = principal - totalDeductions;

  // Maturity date
  const maturityDate = useMemo(() => {
    if (!releaseDate || !term) return null;
    return addMonths(releaseDate, term);
  }, [releaseDate, term]);

  // Amortization
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
      releaseDate
    );
  }, [
    canShowAmortization,
    principal,
    rate,
    interestType,
    term,
    paymentFrequency,
    releaseDate,
  ]);

  const amortizationTotals = useMemo(() => {
    return amortizationSchedule.reduce(
      (acc, row) => ({
        principal: acc.principal + row.principal,
        interest: acc.interest + row.interest,
        totalPayment: acc.totalPayment + row.totalPayment,
      }),
      { principal: 0, interest: 0, totalPayment: 0 }
    );
  }, [amortizationSchedule]);

  // ── Product Selection Handler ──
  const handleProductChange = useCallback(
    (value: string | null) => {
      setProductId(value);
      const product = products.find((p) => p.id === Number(value));
      if (product) {
        setInterestRate(String(product.interest_rate ?? ""));
        setInterestType(product.interest_type ?? null);
        setPaymentFrequency(product.payment_frequency ?? null);
        setProcessingFeeOverride(null);
        setServiceFeeOverride(null);
      }
    },
    [products]
  );

  // ── Borrower Selection Handler ──
  const handleBorrowerChange = useCallback((id: number | null) => {
    setBorrowerId(id);
    setCoMakerId(null);
  }, []);

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
    releaseDate !== undefined;

  const handleSubmit = async () => {
    if (!canSubmit || !releaseDate) return;
    try {
      setSubmitting(true);
      const payload = {
        borrower_id: borrowerId,
        co_maker_ids: coMakerId ? [coMakerId] : [],
        loan_product_id: Number(productId),
        principal_amount: principal,
        interest_rate: rate,
        start_date: formatDateISO(releaseDate),
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
          <CardTitle>Borrower & Co-Maker</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Borrower */}
            <div className="space-y-2">
              <Label>
                Borrower <span className="text-destructive">*</span>
              </Label>
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
                      : "Search borrower..."}
                  </span>
                  <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
                </PopoverTrigger>
                <PopoverContent className="w-(--anchor-width) p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Type a name to search..." />
                    <CommandList>
                      <CommandEmpty>No borrower found.</CommandEmpty>
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

            {/* Co-Maker */}
            <div className="space-y-2">
              <Label>Co-Maker</Label>
              <Popover open={coMakerOpen} onOpenChange={setCoMakerOpen}>
                <PopoverTrigger
                  render={
                    <button
                      type="button"
                      role="combobox"
                      aria-expanded={coMakerOpen}
                      disabled={!borrowerId || coMakers.length === 0}
                      className="flex h-8 w-full items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-2.5 text-sm transition-colors hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
                    />
                  }
                >
                  <span className={cn("truncate", !selectedCoMaker && "text-muted-foreground")}>
                    {selectedCoMaker
                      ? selectedCoMaker.full_name
                      : !borrowerId
                        ? "Select borrower first"
                        : coMakers.length === 0
                          ? "No co-makers available"
                          : "Search co-maker (optional)..."}
                  </span>
                  <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
                </PopoverTrigger>
                <PopoverContent className="w-(--anchor-width) p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Type a name to search..." />
                    <CommandList>
                      <CommandEmpty>No co-maker found.</CommandEmpty>
                      <CommandGroup>
                        {coMakers.map((cm) => (
                          <CommandItem
                            key={cm.id}
                            value={`${cm.full_name} ${cm.relationship}`}
                            onSelect={() => {
                              setCoMakerId(
                                cm.id === coMakerId ? null : cm.id
                              );
                              setCoMakerOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 size-4",
                                coMakerId === cm.id
                                  ? "opacity-100"
                                  : "opacity-0"
                              )}
                            />
                            {cm.full_name}{" "}
                            <span className="text-muted-foreground">
                              ({cm.relationship})
                            </span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
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
                Principal Amount <span className="text-destructive">*</span>
              </Label>
              <Input
                type="number"
                placeholder="0.00"
                value={principalAmount}
                onChange={(e) => setPrincipalAmount(e.target.value)}
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
                value={termMonths}
                onChange={(e) => setTermMonths(e.target.value)}
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
                  <SelectValue placeholder="Select frequency" />
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
                step="0.1"
                value={interestRate}
                onChange={(e) => setInterestRate(e.target.value)}
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
                  <SelectValue placeholder="Select type" />
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
              <Label>
                Processing Fee
                {selectedProduct && (
                  <span className="text-muted-foreground font-normal">
                    {" "}
                    ({selectedProduct.processing_fee}%)
                  </span>
                )}
              </Label>
              <Input
                type="number"
                placeholder="0.00"
                step="0.01"
                value={
                  processingFeeOverride !== null
                    ? processingFeeOverride
                    : processingFee.toFixed(2)
                }
                onChange={(e) => setProcessingFeeOverride(e.target.value)}
              />
            </div>

            {/* Service Fee */}
            <div className="space-y-2">
              <Label>
                Service Fee
                {selectedProduct && (
                  <span className="text-muted-foreground font-normal">
                    {" "}
                    ({selectedProduct.service_fee}%)
                  </span>
                )}
              </Label>
              <Input
                type="number"
                placeholder="0.00"
                step="0.01"
                value={
                  serviceFeeOverride !== null
                    ? serviceFeeOverride
                    : serviceFee.toFixed(2)
                }
                onChange={(e) => setServiceFeeOverride(e.target.value)}
              />
            </div>

            {/* Other Deductions */}
            <div className="space-y-2">
              <Label>Other Deductions</Label>
              <Input
                type="number"
                placeholder="0.00"
                step="0.01"
                value={otherDeductions}
                onChange={(e) => setOtherDeductions(e.target.value)}
              />
            </div>
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
