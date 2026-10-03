"use client";

import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Spinner } from "@/components/ui/spinner";
import { currencyOrDash } from "@/lib/report-format";
import { INSURANCE_PCT_DECIMALS, sanitizeDecimalInput } from "@/lib/percent";
import type {
  InsurancePaymentType,
  InsurancePremiumValue,
} from "./insurance-premium.types";
import {
  partialAmountOnBlur,
  partialExceedsPremium,
  type ReleaseInsuranceView,
} from "../_lib/release-figures";

type Props = {
  value: InsurancePremiumValue;
  onChange: (next: InsurancePremiumValue) => void;
  /** The server's insurance preview for what is typed now. */
  view: ReleaseInsuranceView;
  /** The server's premium for the percentage typed now, once it has answered. */
  premiumAmount: string | null;
  onRetry: () => void;
  disabled?: boolean;
};

/**
 * The insurance the cashier types at release. The premium, the remaining
 * balance and everything after insurance are the server's release preview
 * for these inputs; a figure it has not sent yet is a dash.
 */
export function InsurancePremiumSection({
  value,
  onChange,
  view,
  premiumAmount,
  onRetry,
  disabled,
}: Props) {
  const insurance = view.status === "ready" ? view.preview.insurance : null;
  const noInsurance = view.status === "idle";

  const setField = <K extends keyof InsurancePremiumValue>(
    key: K,
    next: InsurancePremiumValue[K],
  ) => onChange({ ...value, [key]: next });

  const handlePercentageBlur = () => {
    const n = Number(value.percentage);
    if (!Number.isFinite(n) || n <= 0) {
      setField("percentage", "");
      return;
    }
    // Already at most two places — the field refuses a third — so this only
    // caps it at 100%; it never rounds what was typed.
    const clamped = Math.max(0, Math.min(100, n));
    setField("percentage", String(clamped));
  };

  return (
    <div className="space-y-3">
      <Label className="text-sm font-semibold">Insurance Premium</Label>

      <div className="rounded-lg border bg-muted/30 p-4 space-y-4" aria-busy={view.status === "loading"}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="insurance-pct" className="text-xs">
              Insurance Premium Percentage
            </Label>
            <div className="relative">
              <Input
                id="insurance-pct"
                inputMode="decimal"
                placeholder="0.00"
                value={value.percentage}
                onChange={(e) =>
                  setField("percentage", sanitizeDecimalInput(e.target.value, INSURANCE_PCT_DECIMALS))
                }
                onBlur={handlePercentageBlur}
                disabled={disabled}
                className="h-9 pr-8"
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">
                %
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Insurance Premium Amount</Label>
            <div className="flex h-9 items-center rounded-md border border-input bg-muted/50 px-3 text-sm font-medium tabular-nums">
              {currencyOrDash(insurance?.premium_amount ?? premiumAmount)}
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Payment</Label>
          <RadioGroup
            value={value.paymentType}
            onValueChange={(v) =>
              setField("paymentType", v as InsurancePaymentType)
            }
            className="flex gap-6"
          >
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <RadioGroupItem value="full" disabled={disabled} />
              Full
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <RadioGroupItem value="partial" disabled={disabled} />
              Partial
            </label>
          </RadioGroup>
        </div>

        {value.paymentType === "partial" && (
          <div className="rounded-md border border-dashed bg-background p-3 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="insurance-partial" className="text-xs">
                  Partial Amount
                </Label>
                <Input
                  id="insurance-partial"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  placeholder="0.00"
                  value={value.partialAmount}
                  onChange={(e) => setField("partialAmount", e.target.value)}
                  onBlur={() =>
                    setField("partialAmount", partialAmountOnBlur(value.partialAmount, premiumAmount))
                  }
                  disabled={disabled || noInsurance}
                  className="h-9"
                />
                {partialExceedsPremium(value.partialAmount, premiumAmount) && (
                  <p className="text-xs text-amber-600">
                    Partial amount exceeds the total premium. It will be capped
                    to {currencyOrDash(premiumAmount)} when you leave the field.
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Remaining Balance</Label>
                <div className="flex h-9 items-center rounded-md border border-input bg-muted/50 px-3 text-sm font-medium tabular-nums">
                  {currencyOrDash(insurance?.remaining_balance)}
                </div>
              </div>
            </div>
          </div>
        )}

        {view.status === "loading" && (
          <p role="status" className="flex items-center gap-2 text-xs text-muted-foreground">
            <Spinner className="size-3.5" />
            Working out the insurance…
          </p>
        )}
        {view.status === "error" && (
          <div role="alert" className="flex flex-wrap items-center gap-2 text-sm">
            <p className="flex items-center gap-1.5 text-destructive">
              <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
              {view.message}
            </p>
            <Button type="button" variant="outline" size="sm" onClick={onRetry}>
              <RefreshCw className="mr-2 size-4" />
              Retry
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
