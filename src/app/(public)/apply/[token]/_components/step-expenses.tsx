"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DEBT_LINES, EXPENSE_LINES, FREQUENCY_LABELS } from "@/lib/loan-origination";
import type { ExistingDebt, IncomeFrequency } from "@/types/loan-origination";
import { MoneyField, optionsOf, SelectField, TextField } from "./form-field";
import type { StepProps } from "./step-types";

const NEW_LOAN: ExistingDebt = { institution: "", outstanding_balance: "", payment_amount: "", payment_frequency: "monthly", remaining_term: "" };

export function StepExpenses({ value: x, errors, onChange }: StepProps<"expenses">) {
  const setLoan = (i: number, patch: Partial<ExistingDebt>) =>
    onChange({ existing_loans: x.existing_loans.map((l, j) => (j === i ? { ...l, ...patch } : l)) });

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Monthly household expenses</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {EXPENSE_LINES.map(({ key, label }) => (
            <MoneyField key={key} id={key} label={label} value={x[key] as string} error={errors[key]} onChange={(v) => onChange({ [key]: v })} />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold">
            Do you have loans you are still paying? <span className="text-destructive">*</span>
          </legend>
          <div className="flex gap-6 text-sm">
            {[true, false].map((yes) => (
              <label key={String(yes)} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="has_existing_loans"
                  checked={x.has_existing_loans === yes}
                  onChange={() => onChange({ has_existing_loans: yes, existing_loans: yes && x.existing_loans.length === 0 ? [NEW_LOAN] : x.existing_loans })}
                />
                {yes ? "Yes" : "No"}
              </label>
            ))}
          </div>
          {errors.has_existing_loans && <p className="text-xs text-destructive">{errors.has_existing_loans}</p>}
        </fieldset>

        {x.has_existing_loans &&
          x.existing_loans.map((l, i) => (
            <div key={i} className="grid gap-3 rounded-lg border p-3 sm:grid-cols-2">
              <TextField id={`loan-${i}-institution`} label="Lender" required value={l.institution} error={errors[`existing_loans.${i}.institution`]} onChange={(institution) => setLoan(i, { institution })} />
              <MoneyField id={`loan-${i}-balance`} label="Balance left" value={l.outstanding_balance} error={errors[`existing_loans.${i}.outstanding_balance`]} onChange={(outstanding_balance) => setLoan(i, { outstanding_balance })} />
              <MoneyField id={`loan-${i}-payment`} label="Payment" required value={l.payment_amount} error={errors[`existing_loans.${i}.payment_amount`]} onChange={(payment_amount) => setLoan(i, { payment_amount })} />
              <SelectField id={`loan-${i}-frequency`} label="Paid" required options={optionsOf(FREQUENCY_LABELS)} value={l.payment_frequency} error={errors[`existing_loans.${i}.payment_frequency`]} onChange={(v) => setLoan(i, { payment_frequency: v as IncomeFrequency | "" })} />
              <TextField id={`loan-${i}-term`} label="Payments left" inputMode="numeric" value={l.remaining_term} onChange={(remaining_term) => setLoan(i, { remaining_term })} />
              <div className="flex items-end justify-end">
                <Button type="button" variant="ghost" size="sm" onClick={() => onChange({ existing_loans: x.existing_loans.filter((_, j) => j !== i) })}>
                  <Trash2 className="mr-1 h-4 w-4" /> Remove
                </Button>
              </div>
            </div>
          ))}
        {x.has_existing_loans && (
          <>
            {errors.existing_loans && <p className="text-xs text-destructive">{errors.existing_loans}</p>}
            <Button type="button" variant="outline" size="sm" onClick={() => onChange({ existing_loans: [...x.existing_loans, NEW_LOAN] })}>
              <Plus className="mr-1 h-4 w-4" /> Add another loan
            </Button>
          </>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Other monthly payments</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          {DEBT_LINES.map(({ key, label }) => (
            <MoneyField key={key} id={key} label={label} value={x[key] as string} error={errors[key]} onChange={(v) => onChange({ [key]: v })} />
          ))}
        </div>
      </section>
    </div>
  );
}
