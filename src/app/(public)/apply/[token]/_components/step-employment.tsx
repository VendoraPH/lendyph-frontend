"use client";

import { EMPLOYMENT_TYPES, FREQUENCY_LABELS, INCOME_SOURCE_LABELS } from "@/lib/loan-origination";
import type { IncomeFrequency, IncomeSource } from "@/types/loan-origination";
import { MoneyField, optionsOf, SelectField, TextAreaField, TextField } from "./form-field";
import type { StepProps } from "./step-types";

export function StepEmployment({ value: e, errors, onChange }: StepProps<"employment">) {
  const source = e.income_source;
  return (
    <div className="space-y-6">
      <SelectField
        id="income_source"
        label="Where most of your income comes from"
        required
        options={optionsOf(INCOME_SOURCE_LABELS)}
        value={source}
        error={errors.income_source}
        onChange={(v) => onChange({ income_source: v as IncomeSource | "" })}
      />
      {source === "employed" && (
        <section className="grid gap-4 sm:grid-cols-2">
          <TextField id="employer_name" label="Employer" required value={e.employer_name} error={errors.employer_name} onChange={(employer_name) => onChange({ employer_name })} />
          <TextField id="job_title" label="Job title" required value={e.job_title} error={errors.job_title} onChange={(job_title) => onChange({ job_title })} />
          <SelectField id="employment_type" label="Employment type" options={EMPLOYMENT_TYPES} value={e.employment_type} error={errors.employment_type} onChange={(employment_type) => onChange({ employment_type })} />
          <TextField id="years_employed" label="Years with this employer" inputMode="decimal" value={e.years_employed} error={errors.years_employed} onChange={(years_employed) => onChange({ years_employed })} />
          <MoneyField id="gross_monthly_income" label="Gross monthly pay" required value={e.gross_monthly_income} error={errors.gross_monthly_income} onChange={(gross_monthly_income) => onChange({ gross_monthly_income })} />
          <MoneyField id="net_monthly_income" label="Take-home pay a month" hint="After tax and deductions." value={e.net_monthly_income} error={errors.net_monthly_income} onChange={(net_monthly_income) => onChange({ net_monthly_income })} />
          <SelectField id="salary_frequency" label="Paid" required options={optionsOf(FREQUENCY_LABELS)} value={e.salary_frequency} error={errors.salary_frequency} onChange={(v) => onChange({ salary_frequency: v as IncomeFrequency | "" })} />
          <TextField id="employer_address" label="Employer address" value={e.employer_address} error={errors.employer_address} onChange={(employer_address) => onChange({ employer_address })} />
        </section>
      )}
      {(source === "self_employed" || source === "business_owner") && (
        <section className="grid gap-4 sm:grid-cols-2">
          <TextField id="business_name" label="Business name" value={e.business_name} error={errors.business_name} onChange={(business_name) => onChange({ business_name })} />
          <TextField id="business_type" label="Type of business" required placeholder="Sari-sari store" value={e.business_type} error={errors.business_type} onChange={(business_type) => onChange({ business_type })} />
          <TextField id="years_operating" label="Years in operation" inputMode="decimal" value={e.years_operating} error={errors.years_operating} onChange={(years_operating) => onChange({ years_operating })} />
          <TextField id="business_address" label="Business address" value={e.business_address} error={errors.business_address} onChange={(business_address) => onChange({ business_address })} />
          <MoneyField id="monthly_revenue" label="Average sales a month" required value={e.monthly_revenue} error={errors.monthly_revenue} onChange={(monthly_revenue) => onChange({ monthly_revenue })} />
          <MoneyField id="monthly_business_expenses" label="Business costs a month" value={e.monthly_business_expenses} error={errors.monthly_business_expenses} onChange={(monthly_business_expenses) => onChange({ monthly_business_expenses })} />
          <MoneyField id="monthly_net_business_income" label="Net income a month" hint="Leave empty and we use sales less costs." value={e.monthly_net_business_income} error={errors.monthly_net_business_income} onChange={(monthly_net_business_income) => onChange({ monthly_net_business_income })} />
        </section>
      )}
      {(source === "farmer" || source === "pensioner" || source === "other") && (
        <section className="grid gap-4 sm:grid-cols-2">
          <TextField id="other_source_description" label="Source of income" required className="sm:col-span-2" placeholder={source === "farmer" ? "Rice farming, 2 hectares" : source === "pensioner" ? "SSS pension" : ""} value={e.other_source_description} error={errors.other_source_description} onChange={(other_source_description) => onChange({ other_source_description })} />
          <MoneyField id="other_income_amount" label="Amount received" required value={e.other_income_amount} error={errors.other_income_amount} onChange={(other_income_amount) => onChange({ other_income_amount })} />
          <SelectField id="other_income_frequency" label="Received" required options={optionsOf(FREQUENCY_LABELS)} value={e.other_income_frequency} error={errors.other_income_frequency} onChange={(v) => onChange({ other_income_frequency: v as IncomeFrequency | "" })} />
          <TextAreaField id="other_income_details" label="Details" className="sm:col-span-2" value={e.other_income_details} error={errors.other_income_details} onChange={(other_income_details) => onChange({ other_income_details })} />
        </section>
      )}
      {source && (
        <>
          <MoneyField id="other_regular_income" label="Other regular income a month" hint="Remittances, rent received, allowances." value={e.other_regular_income} error={errors.other_regular_income} onChange={(other_regular_income) => onChange({ other_regular_income })} />
          <p className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
            We confirm your income against your documents when we review your application.
          </p>
        </>
      )}
    </div>
  );
}
