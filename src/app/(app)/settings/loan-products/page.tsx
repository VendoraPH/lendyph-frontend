"use client";

import { env } from "@/config/env";
import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useDialogOpening, usePermission } from "@/hooks";
import { toast } from "sonner";
import { loanProductService } from "@/services/loan-product.service";
import { completeRows } from "@/lib/paginate";
import { productSaveRefusal } from "./_lib/product-save";
import { decimalInputValue } from "@/lib/percent";
import { PermissionGate, RouteGuard } from "@/components/common";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  X,
  MoreHorizontal,
  Pencil,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Package,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronDown,
  Info,
} from "lucide-react";
import {
  INTEREST_TYPE_OPTIONS,
  PAYMENT_FREQUENCY_OPTIONS,
  PAYMENT_FREQUENCY_LABELS,
  TERM_UNIT_OPTIONS,
  INTEREST_RATE_FREQUENCY_OPTIONS,
} from "@/constants";
import type { LoanProduct } from "@/types/loan";
import { interestMethodLabel } from "@/app/(app)/loans/new/_lib/loan-preview";
import { formatCurrency } from "@/lib/format";
import {
  EMPTY_FORM,
  PRODUCT_FIELD_LABELS,
  defaultTermError,
  formToApiPayload,
  productToForm,
  retiredCustomFeesNotice,
  type ProductForm,
} from "./_lib/product-form";
import type { PenaltySource } from "./_lib/penalty-source";
import { PenaltySourceLine } from "./_components/penalty-source-line";

// ── Helpers ──

// Helper to read API fields (API uses interest_method/frequency/term, our type has interest_type/payment_frequency/min_term)
function getProductField(product: LoanProduct, field: string): string {
  const p = product as unknown as Record<string, unknown>;
  switch (field) {
    case "interest_method": return String(p.interest_method ?? p.interest_type ?? "straight");
    case "frequency": return String(p.frequency ?? p.payment_frequency ?? "monthly");
    case "term": return String(p.term ?? p.min_term ?? "");
    case "min_term": return String(p.min_term ?? p.term ?? "");
    case "max_term": return String(p.max_term ?? p.term ?? "");
    case "term_unit": return String(p.term_unit ?? "months");
    case "min_interest_rate": return String(p.min_interest_rate ?? p.interest_rate ?? "");
    case "max_interest_rate": return String(p.max_interest_rate ?? p.interest_rate ?? "");
    case "interest_rate_frequency": return String(p.interest_rate_frequency ?? "monthly");
    case "grace_period_days": return String(p.grace_period_days ?? p.grace_period ?? "0");
    case "notarial_fee": return String(p.notarial_fee ?? "0");
    case "min_processing_fee": return String(p.min_processing_fee ?? p.processing_fee ?? "0");
    case "max_processing_fee": return String(p.max_processing_fee ?? p.processing_fee ?? "0");
    case "min_service_fee": return String(p.min_service_fee ?? p.service_fee ?? "0");
    case "max_service_fee": return String(p.max_service_fee ?? p.service_fee ?? "0");
    default: return String(p[field] ?? "");
  }
}

// Format a numeric rate/percentage exactly, trimming trailing zeros.
// Examples: "0.0000" → "0", "5.50" → "5.5", "1.1250" → "1.125", "" → "".
// Never rounded: this also fills the edit form, so two places here saved a
// 1.125% rate back as 1.13% whenever anything else on the product was edited.
function formatRate(value: unknown): string {
  return decimalInputValue(value);
}

function getFeeRange(product: LoanProduct, feeKey: "processing_fee" | "service_fee"): string {
  const min = formatRate(getProductField(product, `min_${feeKey}`));
  const max = formatRate(getProductField(product, `max_${feeKey}`));
  if (min === max) return `${min}%`;
  return `${min}–${max}%`;
}

function getProductFrequencies(product: LoanProduct): string {
  const p = product as unknown as Record<string, unknown>;
  const freqs = p.frequencies ?? p.frequency ?? product.payment_frequency ?? "monthly";
  const arr = Array.isArray(freqs) ? (freqs as string[]) : [String(freqs)];
  return arr.map((f) => PAYMENT_FREQUENCY_LABELS[f] ?? f).join(", ");
}

function getInterestRateDisplay(product: LoanProduct): string {
  const min = formatRate(getProductField(product, "min_interest_rate"));
  const max = formatRate(getProductField(product, "max_interest_rate"));
  const freq = getProductField(product, "interest_rate_frequency");
  // The rate period, not a payment frequency: "annual" reads "Annual".
  const freqLabel = INTEREST_RATE_FREQUENCY_OPTIONS.find((o) => o.value === freq)?.label ?? freq;
  const rate = min && max && min !== max ? `${min}% – ${max}%` : `${min || max}%`;
  return `${rate} / ${freqLabel}`;
}

function getTermDisplay(product: LoanProduct): string {
  const min = getProductField(product, "min_term");
  const max = getProductField(product, "max_term");
  const unit = getProductField(product, "term_unit") === "days" ? "days" : "months";
  if (min && max && min !== max) return `${min} – ${max} ${unit}`;
  return `${min || max} ${unit}`;
}

// ── Product Form Dialog ──

function ProductFormDialog({
  open,
  onOpenChange,
  onSubmit,
  initialData,
  retiredFeesNotice,
  penaltySource,
  title,
  description,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Saves the form: null once the server took it, else the server's message. */
  onSubmit: (form: ProductForm) => Promise<string | null>;
  initialData?: ProductForm;
  /** Shown read-only when the product still holds retired `custom_fees`. */
  retiredFeesNotice?: string | null;
  /** The server's `penalty_source`, shown in place of the rate while penalty configurations are on. */
  penaltySource?: PenaltySource | null;
  title: string;
  description: string;
}) {
  const [form, setForm] = useState<ProductForm>(initialData ?? EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  // The server's refusal, shown in the dialog. The dialog stays open on a
  // refusal so nothing the user typed is lost.
  const [saveError, setSaveError] = useState<string | null>(null);

  if (useDialogOpening(open, initialData)) {
    setForm(initialData ?? EMPTY_FORM);
    setSaveError(null);
  }

  const update = (field: keyof ProductForm, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const termError = defaultTermError(form);
    if (termError) {
      toast.error(termError);
      return;
    }
    setSaving(true);
    setSaveError(null);
    const refusal = await onSubmit(form);
    setSaving(false);
    if (refusal !== null) {
      setSaveError(refusal);
      return;
    }
    if (!initialData) setForm(EMPTY_FORM);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6 max-h-[50vh] lg:max-h-none overflow-y-auto lg:overflow-y-visible overflow-x-hidden px-1">
          {/* Basic Info */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Basic Info
            </h3>
            <div className="space-y-2">
              <Label htmlFor="product-name">{PRODUCT_FIELD_LABELS.name} *</Label>
              <Input
                id="product-name"
                placeholder="e.g. Salary Loan"
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="product-description">{PRODUCT_FIELD_LABELS.description}</Label>
              <Textarea
                id="product-description"
                placeholder="Brief description of this loan product"
                value={form.description}
                onChange={(e) => update("description", e.target.value)}
              />
            </div>
          </div>

          {/* Amount & Term */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Amount & Term
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="min-amount">{PRODUCT_FIELD_LABELS.min_amount} (₱) *</Label>
                <Input
                  id="min-amount"
                  type="number"
                  min={0}
                  step="1"
                  placeholder="5,000"
                  value={form.min_amount}
                  onChange={(e) => update("min_amount", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max-amount">{PRODUCT_FIELD_LABELS.max_amount} (₱) *</Label>
                <Input
                  id="max-amount"
                  type="number"
                  min={0}
                  step="1"
                  placeholder="50,000"
                  value={form.max_amount}
                  onChange={(e) => update("max_amount", e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="min-term">{PRODUCT_FIELD_LABELS.min_term} <span className="text-red-500">*</span></Label>
                <Input
                  id="min-term"
                  type="number"
                  min={1}
                  placeholder="1"
                  value={form.min_term}
                  onChange={(e) => update("min_term", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max-term">{PRODUCT_FIELD_LABELS.max_term} <span className="text-red-500">*</span></Label>
                <Input
                  id="max-term"
                  type="number"
                  min={1}
                  placeholder="24"
                  value={form.max_term}
                  onChange={(e) => update("max_term", e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="default-term">{PRODUCT_FIELD_LABELS.term} <span className="text-red-500">*</span></Label>
                <Input
                  id="default-term"
                  type="number"
                  min={form.min_term || 1}
                  max={form.max_term || undefined}
                  placeholder="12"
                  value={form.term}
                  onChange={(e) => update("term", e.target.value)}
                  aria-describedby="default-term-help"
                  required
                />
                <p id="default-term-help" className="text-xs text-muted-foreground">
                  Between the minimum and maximum term.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="term-unit">{PRODUCT_FIELD_LABELS.term_unit} <span className="text-red-500">*</span></Label>
                <Select
                  value={form.term_unit}
                  onValueChange={(v) => update("term_unit", v ?? "months")}
                >
                  <SelectTrigger id="term-unit" className="w-full">
                    <SelectValue>
                      {(v: string | null) =>
                        TERM_UNIT_OPTIONS.find((o) => o.value === v)?.label ?? v ?? "Select unit"
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {TERM_UNIT_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Interest */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Interest
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="min-interest-rate">{PRODUCT_FIELD_LABELS.min_interest_rate} (%) <span className="text-red-500">*</span></Label>
                <Input
                  id="min-interest-rate"
                  type="number"
                  min={0}
                  step="0.0001"
                  placeholder="1"
                  value={form.min_interest_rate}
                  onChange={(e) => update("min_interest_rate", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max-interest-rate">{PRODUCT_FIELD_LABELS.max_interest_rate} (%) <span className="text-red-500">*</span></Label>
                <Input
                  id="max-interest-rate"
                  type="number"
                  min={0}
                  step="0.0001"
                  placeholder="5"
                  value={form.max_interest_rate}
                  onChange={(e) => update("max_interest_rate", e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="interest-rate-frequency">
                {PRODUCT_FIELD_LABELS.interest_rate_frequency} <span className="text-red-500">*</span>
              </Label>
              <p className="text-xs text-muted-foreground">
                The period each interest rate figure applies to, e.g. 3% <span className="font-medium">per month</span>.
              </p>
              <Select
                value={form.interest_rate_frequency}
                onValueChange={(v) => update("interest_rate_frequency", v ?? "monthly")}
              >
                <SelectTrigger id="interest-rate-frequency" className="w-full sm:w-1/2">
                  <SelectValue>
                    {(v: string | null) =>
                      INTEREST_RATE_FREQUENCY_OPTIONS.find((o) => o.value === v)?.label ?? v ?? "Select frequency"
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {INTEREST_RATE_FREQUENCY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{PRODUCT_FIELD_LABELS.interest_method} *</Label>
                <Select
                  value={form.interest_method}
                  onValueChange={(v) => update("interest_method", v as string)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select method">
                      {(value: string | null) =>
                        value
                          ? (INTEREST_TYPE_OPTIONS.find((o) => o.value === value)?.label ?? value)
                          : "Select method"
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
              <div className="space-y-2">
                <Label>{PRODUCT_FIELD_LABELS.frequencies} <span className="text-red-500">*</span></Label>
                <Popover>
                  <PopoverTrigger
                    className="flex w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  >
                    <span className="flex flex-wrap gap-1 min-h-[20px]">
                      {form.frequencies.length > 0
                        ? form.frequencies.map((f) => (
                            <Badge key={f} variant="secondary" className="text-xs font-normal gap-1">
                              {PAYMENT_FREQUENCY_LABELS[f] ?? f}
                              <span
                                role="button"
                                tabIndex={0}
                                className="hover:text-destructive cursor-pointer"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  if (form.frequencies.length > 1) {
                                    setForm((prev) => ({
                                      ...prev,
                                      frequencies: prev.frequencies.filter((v) => v !== f),
                                    }));
                                  }
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    if (form.frequencies.length > 1) {
                                      setForm((prev) => ({
                                        ...prev,
                                        frequencies: prev.frequencies.filter((v) => v !== f),
                                      }));
                                    }
                                  }
                                }}
                              >
                                <X className="h-3 w-3" />
                              </span>
                            </Badge>
                          ))
                        : <span className="text-muted-foreground">Select frequencies</span>}
                    </span>
                    <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-(--anchor-width) p-1">
                    {PAYMENT_FREQUENCY_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        className={cn(
                          "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent cursor-pointer",
                          form.frequencies.includes(opt.value) && "bg-accent"
                        )}
                        onClick={() => {
                          setForm((prev) => {
                            const has = prev.frequencies.includes(opt.value);
                            const next = has
                              ? prev.frequencies.filter((f) => f !== opt.value)
                              : [...prev.frequencies, opt.value];
                            return { ...prev, frequencies: next.length > 0 ? next : prev.frequencies };
                          });
                        }}
                      >
                        <Checkbox
                          checked={form.frequencies.includes(opt.value)}
                          className="pointer-events-none"
                        />
                        {opt.label}
                      </button>
                    ))}
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>

          {/* Fees & Penalties */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Fees & Penalties
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{PRODUCT_FIELD_LABELS.processing_fee} (%)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    step="0.0001"
                    placeholder="Min"
                    value={form.min_processing_fee}
                    onChange={(e) => update("min_processing_fee", e.target.value)}
                  />
                  <span className="text-muted-foreground text-sm shrink-0">–</span>
                  <Input
                    type="number"
                    min={0}
                    step="0.0001"
                    placeholder="Max"
                    value={form.max_processing_fee}
                    onChange={(e) => update("max_processing_fee", e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{PRODUCT_FIELD_LABELS.service_fee} (%)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    step="0.0001"
                    placeholder="Min"
                    value={form.min_service_fee}
                    onChange={(e) => update("min_service_fee", e.target.value)}
                  />
                  <span className="text-muted-foreground text-sm shrink-0">–</span>
                  <Input
                    type="number"
                    min={0}
                    step="0.0001"
                    placeholder="Max"
                    value={form.max_service_fee}
                    onChange={(e) => update("max_service_fee", e.target.value)}
                  />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="notarial-fee">{PRODUCT_FIELD_LABELS.notarial_fee} (%)</Label>
                <Input
                  id="notarial-fee"
                  type="number"
                  min={0}
                  max={100}
                  step="0.0001"
                  placeholder="1"
                  value={form.notarial_fee}
                  onChange={(e) => update("notarial_fee", e.target.value)}
                />
              </div>
              {env.features.penaltyConfigs ? (
                // Penalty terms are set in Settings → Penalties; the stored rate
                // is sent back unchanged, so the server's answer decides.
                <div className="space-y-2">
                  <p className="text-sm font-medium">Penalty</p>
                  <p className="text-sm text-muted-foreground">
                    <PenaltySourceLine source={penaltySource} isNew={!initialData} />
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="penalty-rate">{PRODUCT_FIELD_LABELS.penalty_rate} (% per month)</Label>
                  <Input
                    id="penalty-rate"
                    type="number"
                    min={0}
                    step="0.0001"
                    placeholder="3"
                    value={form.penalty_rate}
                    onChange={(e) => update("penalty_rate", e.target.value)}
                  />
                </div>
              )}
            </div>

            {/* Grace Period Toggle */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="grace-period-toggle" className="cursor-pointer">
                  {PRODUCT_FIELD_LABELS.grace_period_days}
                </Label>
                <Switch
                  id="grace-period-toggle"
                  checked={form.grace_period_enabled}
                  onCheckedChange={(checked) =>
                    setForm((prev) => ({
                      ...prev,
                      grace_period_enabled: checked,
                      grace_period_days: checked ? prev.grace_period_days : "",
                    }))
                  }
                />
              </div>
              {form.grace_period_enabled && (
                <div className="space-y-2">
                  <Label htmlFor="grace-period">{PRODUCT_FIELD_LABELS.grace_period_days} (days)</Label>
                  <Input
                    id="grace-period"
                    type="number"
                    min={1}
                    placeholder="3"
                    value={form.grace_period_days}
                    onChange={(e) => update("grace_period_days", e.target.value)}
                    required
                  />
                </div>
              )}
            </div>
          </div>

          {/* Share Capital Build-Up */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Share Capital Build-Up
            </h3>
            <div className="rounded-lg border p-4 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-0.5">
                  <Label htmlFor="scb-required" className="cursor-pointer text-sm font-medium">
                    Make Share Capital Build-Up Required
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    When enabled, every loan using this product will include an
                    SCB amount added to each amortization period. When the
                    member pays, the SCB portion is credited to their share
                    capital.
                  </p>
                </div>
                <Switch
                  id="scb-required"
                  checked={form.scb_required}
                  onCheckedChange={(checked) =>
                    setForm((prev) => ({
                      ...prev,
                      scb_required: checked,
                      min_scb: checked ? prev.min_scb : "",
                      max_scb: checked ? prev.max_scb : "",
                    }))
                  }
                />
              </div>
              {form.scb_required && (
                <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                  <div className="space-y-2">
                    <Label htmlFor="min-scb">
                      {PRODUCT_FIELD_LABELS.min_scb} (₱){" "}
                      <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="min-scb"
                      type="number"
                      min={0}
                      step="1"
                      placeholder="100"
                      value={form.min_scb}
                      onChange={(e) => update("min_scb", e.target.value)}
                      required={form.scb_required}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="max-scb">
                      {PRODUCT_FIELD_LABELS.max_scb} (₱){" "}
                      <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="max-scb"
                      type="number"
                      min={0}
                      step="1"
                      placeholder="1000"
                      value={form.max_scb}
                      onChange={(e) => update("max_scb", e.target.value)}
                      required={form.scb_required}
                    />
                  </div>
                  <p className="col-span-2 text-xs text-muted-foreground">
                    When creating a loan with this product, the loan officer
                    picks an SCB amount within this range.
                  </p>
                </div>
              )}
            </div>
          </div>

          {retiredFeesNotice && (
            <Alert>
              <Info aria-hidden="true" />
              <AlertTitle>Additional fees are retired</AlertTitle>
              <AlertDescription className="space-y-2">
                <p>{retiredFeesNotice}</p>
                <PermissionGate permission="fees:view">
                  <Button
                    size="sm"
                    variant="outline"
                    nativeButton={false}
                    render={<Link href="/settings/fees" />}
                  >
                    Open Fees settings
                  </Button>
                </PermissionGate>
              </AlertDescription>
            </Alert>
          )}

          {saveError && (
            <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {saveError}
            </p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark"
            >
              {saving ? "Saving…" : initialData ? "Save Changes" : "Create Product"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Toggle Status Dialog ──

function ToggleStatusDialog({
  product,
  open,
  onOpenChange,
  onConfirm,
}: {
  product: LoanProduct;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  const isActive = product.is_active;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-brand-orange" />
            {isActive ? "Deactivate" : "Activate"} Product
          </DialogTitle>
          <DialogDescription>
            {isActive
              ? `Are you sure you want to deactivate "${product.name}"? It will no longer appear as an option during loan applications.`
              : `Are you sure you want to activate "${product.name}"? It will become available for loan applications.`}
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
            className={
              isActive
                ? "bg-destructive text-white hover:bg-destructive/90"
                : "bg-green-600 text-white hover:bg-green-700"
            }
          >
            {isActive ? "Deactivate" : "Activate"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Delete Product Dialog ──

function DeleteProductDialog({
  product,
  open,
  onOpenChange,
  onConfirm,
}: {
  product: LoanProduct;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" />
            Delete Loan Product
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to permanently delete &quot;{product.name}&quot;?
            This action cannot be undone. Existing loans using this product will
            not be affected.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            Delete
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Product Actions Cell ──

function ProductActionsCell({
  product,
  onEdit,
  onToggleStatus,
  onDelete,
}: {
  product: LoanProduct;
  onEdit: (form: ProductForm) => Promise<string | null>;
  onToggleStatus: () => void;
  onDelete: () => void;
}) {
  const [openDialog, setOpenDialog] = useState<string | null>(null);
  // Built once per product record, not per render: the edit dialog refills its
  // form whenever this changes while it is open, which would drop what the
  // user has typed on any unrelated re-render.
  const initialData = useMemo(() => productToForm(product), [product]);
  const retiredFeesNotice = useMemo(
    () => retiredCustomFeesNotice((product as unknown as Record<string, unknown>).custom_fees),
    [product],
  );

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="outline-none">
          <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setOpenDialog("edit")}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setOpenDialog("status")}>
            {product.is_active ? (
              <ToggleLeft className="mr-2 h-4 w-4" />
            ) : (
              <ToggleRight className="mr-2 h-4 w-4" />
            )}
            {product.is_active ? "Deactivate" : "Activate"}
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive"
            onClick={() => setOpenDialog("delete")}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ProductFormDialog
        open={openDialog === "edit"}
        onOpenChange={(v) => !v && setOpenDialog(null)}
        onSubmit={onEdit}
        initialData={initialData}
        retiredFeesNotice={retiredFeesNotice}
        penaltySource={product.penalty_source}
        title="Edit Loan Product"
        description={`Update the configuration for ${product.name}.`}
      />
      <ToggleStatusDialog
        product={product}
        open={openDialog === "status"}
        onOpenChange={(v) => !v && setOpenDialog(null)}
        onConfirm={onToggleStatus}
      />
      <DeleteProductDialog
        product={product}
        open={openDialog === "delete"}
        onOpenChange={(v) => !v && setOpenDialog(null)}
        onConfirm={onDelete}
      />
    </>
  );
}

// ── Main Page ──

function LoanProductsContent() {
  // Creating, editing (activating and deactivating included) and deleting a
  // product needs `loan_products:manage`; the page itself only `loans:view`.
  const canManage = usePermission().can("loan_products:manage");
  const [products, setProducts] = useState<LoanProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      setProducts(completeRows(await loanProductService.listAll()));
    } catch {
      toast.error("We couldn't load the loan products. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const activeCount = products.filter((p) => p.is_active).length;
  const inactiveCount = products.filter((p) => !p.is_active).length;

  // Each answers null once saved, else the server's message, which the dialog
  // shows while it stays open on the user's entries.
  const handleAdd = async (form: ProductForm): Promise<string | null> => {
    const refusal = await productSaveRefusal(
      () => loanProductService.create(formToApiPayload(form)),
      "We couldn't create this loan product. Please try again.",
    );
    if (refusal !== null) {
      toast.error(refusal);
      return refusal;
    }
    toast.success("Loan product created");
    fetchProducts();
    return null;
  };

  const handleEdit = async (id: number, form: ProductForm): Promise<string | null> => {
    const refusal = await productSaveRefusal(
      () => loanProductService.update(id, formToApiPayload(form)),
      "We couldn't update this loan product. Please try again.",
    );
    if (refusal !== null) {
      toast.error(refusal);
      return refusal;
    }
    toast.success("Loan product updated");
    fetchProducts();
    return null;
  };

  const handleToggleStatus = async (id: number) => {
    const product = products.find((p) => p.id === id);
    if (!product) return;
    try {
      await loanProductService.update(id, { is_active: !product.is_active } as unknown as Parameters<typeof loanProductService.update>[1]);
      toast.success(product.is_active ? "Product deactivated" : "Product activated");
      fetchProducts();
    } catch {
      toast.error("We couldn't update the product status. Please try again.");
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await loanProductService.delete(id);
      toast.success("Loan product deleted");
      fetchProducts();
    } catch {
      toast.error("We couldn't delete the loan product. Please try again.");
    }
  };

  return (
    <div className="space-y-6 min-w-0">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Loan Products</h1>
          <p className="text-muted-foreground">
            Configure loan products and terms for loan applications
          </p>
        </div>
        <PermissionGate permission="loan_products:manage">
          <Button
            onClick={() => setAddDialogOpen(true)}
            className="bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark w-full sm:w-auto"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Loan Product
          </Button>
        </PermissionGate>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Package className="h-4 w-4" />
                <span className="text-sm font-medium">Total Products</span>
              </div>
              <span className="text-2xl font-bold">{products.length}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-sm font-medium">Active</span>
              </div>
              <span className="text-2xl font-bold text-green-600">
                {activeCount}
              </span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-red-600">
                <XCircle className="h-4 w-4" />
                <span className="text-sm font-medium">Inactive</span>
              </div>
              <span className="text-2xl font-bold text-red-600">
                {inactiveCount}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner className="size-6 text-brand-orange" />
        </div>
      ) : (
      <>
      {/* Mobile Card View */}
      <div className="space-y-3 md:hidden">
        <p className="text-sm font-medium text-muted-foreground">
          All Products ({products.length})
        </p>
        {products.map((product) => (
          <Card key={product.id}>
            <CardContent className="py-4">
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">{product.name}</p>
                    <Switch
                      checked={product.is_active}
                      onCheckedChange={() => handleToggleStatus(product.id)}
                      disabled={!canManage}
                    />
                  </div>
                  {product.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                      {product.description}
                    </p>
                  )}
                </div>
                <PermissionGate permission="loan_products:manage">
                  <ProductActionsCell
                    product={product}
                    onEdit={(form) => handleEdit(product.id, form)}
                    onToggleStatus={() => handleToggleStatus(product.id)}
                    onDelete={() => handleDelete(product.id)}
                  />
                </PermissionGate>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Interest</p>
                  <p className="font-medium">
                    {getInterestRateDisplay(product)}{" "}
                    <span className="text-muted-foreground font-normal">
                      {interestMethodLabel(getProductField(product, "interest_method"))}
                    </span>
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Frequency</p>
                  <p className="text-xs">{getProductFrequencies(product)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Amount</p>
                  <p className="text-xs">
                    {formatCurrency(product.min_amount)} – {formatCurrency(product.max_amount)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Term</p>
                  <p className="text-xs">{getTermDisplay(product)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Fees</p>
                  <p className="text-xs">
                    Processing {getFeeRange(product, "processing_fee")} · Service {getFeeRange(product, "service_fee")}
                    {Number(getProductField(product, "notarial_fee")) > 0 && ` · Notarial ${formatRate(getProductField(product, "notarial_fee"))}%`}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Penalty</p>
                  <p className="text-xs">
                    {env.features.penaltyConfigs ? (
                      <PenaltySourceLine source={product.penalty_source} />
                    ) : (
                      `${formatRate(product.penalty_rate)}%/mo`
                    )}
                    {Number(getProductField(product, "grace_period_days")) > 0 && ` · ${getProductField(product, "grace_period_days")}d grace`}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {products.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No loan products found. Add one to get started.
            </CardContent>
          </Card>
        )}
      </div>

      {/* Desktop Table View */}
      <Card className="hidden md:block min-w-0 overflow-hidden">
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            All Products ({products.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Interest</TableHead>
                  <TableHead>Term</TableHead>
                  <TableHead>Amount Range</TableHead>
                  <TableHead>Frequency</TableHead>
                  <TableHead>Fees</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{product.name}</p>
                        {product.description && (
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {product.description}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <span className="font-medium">
                          {getInterestRateDisplay(product)}
                        </span>
                        <span className="text-muted-foreground ml-1">
                          {interestMethodLabel(getProductField(product, "interest_method"))}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {getTermDisplay(product)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {formatCurrency(product.min_amount)} —{" "}
                      {formatCurrency(product.max_amount)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {getProductFrequencies(product)}
                    </TableCell>
                    <TableCell>
                      <div className="text-xs text-muted-foreground whitespace-nowrap">
                        <span>Processing: {getFeeRange(product, "processing_fee")}</span>
                        <br />
                        <span>Service: {getFeeRange(product, "service_fee")}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={product.is_active}
                          onCheckedChange={() => handleToggleStatus(product.id)}
                          disabled={!canManage}
                        />
                        <span className={cn("text-xs font-medium", product.is_active ? "text-green-600" : "text-muted-foreground")}>
                          {product.is_active ? "Active" : "Inactive"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <PermissionGate permission="loan_products:manage">
                        <ProductActionsCell
                          product={product}
                          onEdit={(form) => handleEdit(product.id, form)}
                          onToggleStatus={() => handleToggleStatus(product.id)}
                          onDelete={() => handleDelete(product.id)}
                        />
                      </PermissionGate>
                    </TableCell>
                  </TableRow>
                ))}
                {products.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="h-24 text-center text-muted-foreground"
                    >
                      No loan products found. Add one to get started.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      </>
      )}

      {/* Add Product Dialog */}
      <ProductFormDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onSubmit={handleAdd}
        title="Add Loan Product"
        description="Create a new loan product that staff can select during loan applications."
      />
    </div>
  );
}

export default function LoanProductsPage() {
  return (
    <RouteGuard permission="loans:view" pageName="Loan Products">
      <LoanProductsContent />
    </RouteGuard>
  );
}
