"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, CalendarIcon, Info } from "lucide-react";

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

// ── Mock Data ──

const MOCK_BORROWERS = [
  {
    id: 1,
    borrower_code: "BRW-20260001",
    full_name: "Rosario D. Santos",
    phone: "09171234567",
    status: "active",
  },
  {
    id: 2,
    borrower_code: "BRW-20260002",
    full_name: "Roberto Garcia",
    phone: "09181234567",
    status: "active",
  },
  {
    id: 3,
    borrower_code: "BRW-20260003",
    full_name: "Maria L. Reyes",
    phone: "09191234567",
    status: "active",
  },
  {
    id: 4,
    borrower_code: "BRW-20260004",
    full_name: "Eduardo Mendoza",
    phone: "09201234567",
    status: "active",
  },
  {
    id: 5,
    borrower_code: "BRW-20260005",
    full_name: "Carmen A. Torres",
    phone: "09211234567",
    status: "inactive",
  },
  {
    id: 6,
    borrower_code: "BRW-20260006",
    full_name: "Danilo Villanueva",
    phone: "09221234567",
    status: "blacklisted",
  },
] as const;

const MOCK_CO_MAKERS: Record<
  number,
  { id: number; full_name: string; relationship: string }[]
> = {
  1: [{ id: 1, full_name: "Ricardo Santos", relationship: "Spouse" }],
  2: [
    { id: 2, full_name: "Elena Garcia", relationship: "Spouse" },
    { id: 3, full_name: "Pedro Garcia", relationship: "Sibling" },
  ],
  3: [],
  4: [{ id: 4, full_name: "Gloria Mendoza", relationship: "Sister" }],
  5: [],
  6: [{ id: 5, full_name: "Rosa Villanueva", relationship: "Spouse" }],
};

const MOCK_PRODUCTS: LoanProduct[] = [
  {
    id: 1,
    name: "Salary Loan",
    description: "Short-term loan for employed individuals",
    min_amount: 5000,
    max_amount: 50000,
    interest_rate: 3,
    interest_type: "fixed",
    min_term: 1,
    max_term: 12,
    payment_frequency: "monthly",
    processing_fee: 2,
    service_fee: 1,
    penalty_rate: 0.5,
    grace_period: 3,
    is_active: true,
    created_at: "2026-01-15",
    updated_at: "2026-01-15",
  },
  {
    id: 2,
    name: "Business Loan",
    description: "Working capital for SMEs",
    min_amount: 50000,
    max_amount: 500000,
    interest_rate: 2,
    interest_type: "diminishing",
    min_term: 6,
    max_term: 36,
    payment_frequency: "monthly",
    processing_fee: 3,
    service_fee: 1.5,
    penalty_rate: 0.3,
    grace_period: 5,
    is_active: true,
    created_at: "2026-01-20",
    updated_at: "2026-01-20",
  },
  {
    id: 3,
    name: "Emergency Loan",
    description: "Quick-release for urgent needs",
    min_amount: 1000,
    max_amount: 20000,
    interest_rate: 5,
    interest_type: "fixed",
    min_term: 1,
    max_term: 3,
    payment_frequency: "weekly",
    processing_fee: 1,
    service_fee: 0,
    penalty_rate: 1,
    grace_period: 1,
    is_active: true,
    created_at: "2026-02-01",
    updated_at: "2026-02-01",
  },
  {
    id: 4,
    name: "Agricultural Loan",
    description: "Crop financing and farm equipment",
    min_amount: 20000,
    max_amount: 200000,
    interest_rate: 2.5,
    interest_type: "fixed",
    min_term: 3,
    max_term: 24,
    payment_frequency: "monthly",
    processing_fee: 2,
    service_fee: 1,
    penalty_rate: 0.3,
    grace_period: 7,
    is_active: true,
    created_at: "2026-02-10",
    updated_at: "2026-02-10",
  },
  {
    id: 5,
    name: "OFW Loan",
    description: "Pre-departure and family assistance",
    min_amount: 30000,
    max_amount: 300000,
    interest_rate: 2,
    interest_type: "diminishing",
    min_term: 6,
    max_term: 24,
    payment_frequency: "monthly",
    processing_fee: 2.5,
    service_fee: 1,
    penalty_rate: 0.5,
    grace_period: 5,
    is_active: true,
    created_at: "2026-02-20",
    updated_at: "2026-02-20",
  },
];

// ── Helpers ──

const APPLICATION_NUMBER = "LA-20260001";

type PaymentFrequency = "daily" | "weekly" | "bi_weekly" | "monthly";
type InterestType = "fixed" | "diminishing";

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
  // ── Borrower & Co-Maker State ──
  const [borrowerId, setBorrowerId] = useState<number | null>(null);
  const [coMakerId, setCoMakerId] = useState<number | null>(null);
  const [purpose, setPurpose] = useState("");

  // ── Loan Product & Terms State ──
  const [productId, setProductId] = useState<number | null>(null);
  const [principalAmount, setPrincipalAmount] = useState<string>("");
  const [termMonths, setTermMonths] = useState<string>("");
  const [paymentFrequency, setPaymentFrequency] =
    useState<PaymentFrequency | null>(null);
  const [interestRate, setInterestRate] = useState<string>("");
  const [interestType, setInterestType] = useState<InterestType | null>(null);

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

  // ── Derived ──
  const selectedProduct = useMemo(
    () => MOCK_PRODUCTS.find((p) => p.id === productId) ?? null,
    [productId]
  );

  const coMakers = useMemo(
    () => (borrowerId ? MOCK_CO_MAKERS[borrowerId] ?? [] : []),
    [borrowerId]
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
      interestType,
      term,
      paymentFrequency,
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
    (id: number | null) => {
      setProductId(id);
      const product = MOCK_PRODUCTS.find((p) => p.id === id);
      if (product) {
        setInterestRate(String(product.interest_rate));
        setInterestType(product.interest_type);
        setPaymentFrequency(product.payment_frequency);
        setProcessingFeeOverride(null);
        setServiceFeeOverride(null);
      }
    },
    []
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

  const handleSubmit = () => {
    if (!canSubmit) return;

    const borrower = MOCK_BORROWERS.find((b) => b.id === borrowerId);
    toast.success("Loan Application Submitted", {
      description: `Application ${APPLICATION_NUMBER} for ${borrower?.full_name} — ${formatCurrency(principal)} has been submitted successfully.`,
    });
  };

  return (
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
        <div className="text-sm text-muted-foreground">
          Application No.{" "}
          <span className="font-mono font-semibold text-foreground">
            {APPLICATION_NUMBER}
          </span>
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
              <Select
                value={borrowerId}
                onValueChange={(value) => handleBorrowerChange(value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a borrower" />
                </SelectTrigger>
                <SelectContent>
                  {MOCK_BORROWERS.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.full_name}{" "}
                      <span className="text-muted-foreground">
                        ({b.borrower_code})
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Co-Maker */}
            <div className="space-y-2">
              <Label>Co-Maker</Label>
              <Select
                value={coMakerId}
                onValueChange={(value) => setCoMakerId(value)}
                disabled={!borrowerId || coMakers.length === 0}
              >
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={
                      !borrowerId
                        ? "Select borrower first"
                        : coMakers.length === 0
                          ? "No co-makers available"
                          : "Select a co-maker (optional)"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {coMakers.map((cm) => (
                    <SelectItem key={cm.id} value={cm.id}>
                      {cm.full_name}{" "}
                      <span className="text-muted-foreground">
                        ({cm.relationship})
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              value={productId}
              onValueChange={(value) => handleProductChange(value)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a loan product" />
              </SelectTrigger>
              <SelectContent>
                {MOCK_PRODUCTS.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
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
                value={paymentFrequency}
                onValueChange={(value) =>
                  setPaymentFrequency(value as PaymentFrequency)
                }
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
                value={interestType}
                onValueChange={(value) =>
                  setInterestType(value as InterestType)
                }
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
          disabled={!canSubmit}
          onClick={handleSubmit}
        >
          Submit Loan Application
        </Button>
      </div>
    </div>
  );
}
