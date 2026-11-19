"use client";

import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { INCOME_SOURCE_LABELS } from "@/lib/loan-origination";
import type { IncomeSource, OriginationSettings } from "@/types/loan-origination";
import { NumberField, SettingsCard, ToggleField } from "./fields";

type AssessmentRules = OriginationSettings["assessment"];
const SOURCES = Object.keys(INCOME_SOURCE_LABELS) as IncomeSource[];

/**
 * The thresholds the server's affordability check uses. The browser never
 * computes a result from these; they are only stored.
 */
export function AssessmentSection({ value, onChange }: { value: AssessmentRules; onChange: (next: AssessmentRules) => void }) {
  const set = (patch: Partial<AssessmentRules>) => onChange({ ...value, ...patch });
  return (
    <>
      <SettingsCard
        title="Affordability thresholds"
        description="An application outside any of these is marked for further review or above capacity. Staff still decide."
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField
            label="Highest debt-to-income"
            suffix="%"
            step={0.5}
            hint="All monthly debt payments, including the new loan, over eligible income."
            value={value.max_dti}
            onChange={(v) => set({ max_dti: v ?? 0 })}
          />
          <NumberField
            label="Lowest payment coverage"
            suffix="times"
            step={0.05}
            hint="Income left after expenses and debts, over the new loan's payment."
            value={value.min_coverage}
            onChange={(v) => set({ min_coverage: v ?? 0 })}
          />
          <NumberField
            label="Lowest remaining income"
            suffix="pesos a month"
            step={100}
            hint="What the applicant keeps after every payment."
            value={value.min_remaining_income}
            onChange={(v) => set({ min_remaining_income: v ?? 0 })}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <NumberField
            label="Shortest time employed or in business"
            suffix="years"
            nullable
            step={0.5}
            hint="Leave empty for no minimum."
            value={value.min_employment_years}
            onChange={(min_employment_years) => set({ min_employment_years })}
          />
          <div className="space-y-1.5">
            <Label htmlFor="missing-rule">When information is missing</Label>
            <NativeSelect
              id="missing-rule"
              className="w-full"
              value={value.missing_information_rule}
              onChange={(e) => set({ missing_information_rule: e.target.value as AssessmentRules["missing_information_rule"] })}
            >
              <NativeSelectOption value="provisional">Assess with what is given, marked provisional</NativeSelectOption>
              <NativeSelectOption value="insufficient">Mark as insufficient information</NativeSelectOption>
            </NativeSelect>
          </div>
        </div>
        <ToggleField
          label="Count only verified income"
          hint="Income without a verified payslip, ITR or business record is left out of eligible income."
          checked={value.require_verified_income}
          onChange={(require_verified_income) => set({ require_verified_income })}
        />
      </SettingsCard>
      <SettingsCard
        title="How much income counts"
        description="The share of each kind of declared income treated as eligible, to allow for irregular earnings."
      >
        <div className="grid gap-4 sm:grid-cols-3">
          {SOURCES.map((s) => (
            <NumberField
              key={s}
              label={INCOME_SOURCE_LABELS[s]}
              suffix="%"
              value={value.income_recognition[s] ?? 100}
              onChange={(v) => set({ income_recognition: { ...value.income_recognition, [s]: Math.min(v ?? 0, 100) } })}
            />
          ))}
        </div>
      </SettingsCard>
    </>
  );
}
