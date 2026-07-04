"use client";

import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { formatCurrency } from "@/lib/format";
import type {
  InsurancePaymentType,
  InsurancePremiumValue,
} from "./insurance-premium.types";

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function computeInsurancePremium(
  principalAmount: number,
  value: InsurancePremiumValue,
): {
  totalPremium: number;
  upfrontDeduction: number;
  remainingBalance: number;
  partialOverflow: boolean;
} {
  const principal = Math.max(0, Number(principalAmount) || 0);
  const pct = Math.max(0, Math.min(100, Number(value.percentage) || 0));
  const totalPremium = round2(principal * (pct / 100));

  if (value.paymentType === "full") {
    return {
      totalPremium,
      upfrontDeduction: totalPremium,
      remainingBalance: 0,
      partialOverflow: false,
    };
  }

  const rawPartial = Math.max(0, Number(value.partialAmount) || 0);
  const partialOverflow = rawPartial > totalPremium;
  const partial = Math.min(rawPartial, totalPremium);

  return {
    totalPremium,
    upfrontDeduction: partial,
    remainingBalance: round2(totalPremium - partial),
    partialOverflow,
  };
}

type Props = {
  principalAmount: number;
  value: InsurancePremiumValue;
  onChange: (next: InsurancePremiumValue) => void;
  disabled?: boolean;
};

export function InsurancePremiumSection({
  principalAmount,
  value,
  onChange,
  disabled,
}: Props) {
  const { totalPremium, remainingBalance, partialOverflow } = useMemo(
    () => computeInsurancePremium(principalAmount, value),
    [principalAmount, value],
  );

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
    const clamped = Math.max(0, Math.min(100, n));
    setField("percentage", String(round2(clamped)));
  };

  const handlePartialBlur = () => {
    const n = Number(value.partialAmount);
    if (!Number.isFinite(n) || n <= 0) {
      setField("partialAmount", "");
      return;
    }
    const clamped = Math.max(0, Math.min(totalPremium, n));
    setField("partialAmount", String(round2(clamped)));
  };

  return (
    <div className="space-y-3">
      <Label className="text-sm font-semibold">Insurance Premium</Label>

      <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="insurance-pct" className="text-xs">
              Insurance Premium Percentage
            </Label>
            <div className="relative">
              <Input
                id="insurance-pct"
                type="number"
                inputMode="decimal"
                min={0}
                max={100}
                step="0.01"
                placeholder="0.00"
                value={value.percentage}
                onChange={(e) => setField("percentage", e.target.value)}
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
              {formatCurrency(totalPremium)}
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
                  onBlur={handlePartialBlur}
                  disabled={disabled || totalPremium <= 0}
                  className="h-9"
                />
                {partialOverflow && (
                  <p className="text-xs text-amber-600">
                    Partial amount exceeds the total premium. It will be capped
                    to {formatCurrency(totalPremium)} on confirm.
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Remaining Balance</Label>
                <div className="flex h-9 items-center rounded-md border border-input bg-muted/50 px-3 text-sm font-medium tabular-nums">
                  {formatCurrency(remainingBalance)}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
