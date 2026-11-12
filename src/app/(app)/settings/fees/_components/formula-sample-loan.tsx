"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { PERIOD_DAYS, ratePeriodWord, type RateFrequency } from "@/lib/loan-terms";
import type { FormulaSampleInput } from "@/lib/fee-form";

const RATE_PERIODS = (Object.keys(PERIOD_DAYS) as RateFrequency[]).map((key) => ({
  value: key,
  label: `Per ${ratePeriodWord(key)}`,
}));

interface Props {
  sample: FormulaSampleInput;
  onChange: (sample: FormulaSampleInput) => void;
}

/**
 * The sample loan the server works the formula out on. Only a preview: each
 * real loan is charged from its own figures at release.
 */
export function FormulaSampleLoan({ sample, onChange }: Props) {
  const set = <K extends keyof FormulaSampleInput>(key: K, value: FormulaSampleInput[K]) =>
    onChange({ ...sample, [key]: value });

  return (
    <fieldset className="space-y-2 rounded-md border p-3">
      <legend className="px-1 text-xs font-medium">Sample loan for the check</legend>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor="fee-sample-amount" className="text-xs">Loan amount (₱)</Label>
          <Input
            id="fee-sample-amount"
            inputMode="decimal"
            value={sample.principalAmount}
            onChange={(e) => set("principalAmount", e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="fee-sample-rate" className="text-xs">Interest rate (%)</Label>
          <Input
            id="fee-sample-rate"
            inputMode="decimal"
            value={sample.interestRate}
            onChange={(e) => set("interestRate", e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="fee-sample-rate-period" className="text-xs">Rate period</Label>
          <NativeSelect
            id="fee-sample-rate-period"
            className="w-full"
            value={sample.rateFrequency}
            onChange={(e) => set("rateFrequency", e.target.value as RateFrequency)}
          >
            {RATE_PERIODS.map((period) => (
              <NativeSelectOption key={period.value} value={period.value}>{period.label}</NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1">
          <Label htmlFor="fee-sample-term" className="text-xs">Term</Label>
          <Input
            id="fee-sample-term"
            inputMode="numeric"
            value={sample.term}
            onChange={(e) => set("term", e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="fee-sample-term-unit" className="text-xs">Term unit</Label>
          <NativeSelect
            id="fee-sample-term-unit"
            className="w-full"
            value={sample.termUnit}
            onChange={(e) => set("termUnit", e.target.value === "days" ? "days" : "months")}
          >
            <NativeSelectOption value="months">Months</NativeSelectOption>
            <NativeSelectOption value="days">Days</NativeSelectOption>
          </NativeSelect>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">
        The sample starts today; the server works out its maturity date as a loan&apos;s schedule does.
      </p>
    </fieldset>
  );
}
