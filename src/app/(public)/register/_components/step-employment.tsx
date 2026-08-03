"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export interface StepEmploymentData {
  employer_or_business: string;
  date_hired: string;
  monthly_income: string;
  pledge_amount: string;
}

interface Props {
  employment: StepEmploymentData;
  onChange: <K extends keyof StepEmploymentData>(
    field: K,
    value: StepEmploymentData[K]
  ) => void;
  onNext: () => void;
  onBack: () => void;
}

export function StepEmployment({ employment, onChange, onNext, onBack }: Props) {
  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-sm font-semibold">Employment &amp; Income</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="employer_or_business">Employer / Business Name</Label>
            <Input
              id="employer_or_business"
              placeholder="Company or business name"
              value={employment.employer_or_business}
              onChange={(e) => onChange("employer_or_business", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="date_hired">Date Hired</Label>
            <Input
              id="date_hired"
              type="date"
              max={new Date().toLocaleDateString("en-CA")}
              value={employment.date_hired}
              onChange={(e) => onChange("date_hired", e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="monthly_income">Monthly Income (PHP)</Label>
            <Input
              id="monthly_income"
              type="number"
              min={0}
              step={100}
              placeholder="0"
              value={employment.monthly_income}
              onChange={(e) => onChange("monthly_income", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pledge_amount">Pledge Amount (PHP)</Label>
            <Input
              id="pledge_amount"
              type="number"
              min={0}
              step={100}
              placeholder="0"
              value={employment.pledge_amount}
              onChange={(e) => onChange("pledge_amount", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Share capital pledge. Defaults to ₱0 if left empty.
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-border">
        <Button type="button" variant="outline" onClick={onBack}>
          ← Back
        </Button>
        <Button
          type="button"
          onClick={onNext}
          className="bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark"
        >
          Next →
        </Button>
      </div>
    </div>
  );
}
