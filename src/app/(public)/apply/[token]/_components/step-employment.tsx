"use client";

import { EMPLOYMENT_TYPES, FREQUENCY_LABELS, INCOME_SOURCE_LABELS } from "@/lib/loan-origination";
import type { IncomeFrequency, IncomeSource } from "@/types/loan-origination";
import { askedFields, BUSINESS_FIELDS, EMPLOYED_FIELDS, OTHER_SOURCE_FIELDS, visibleFields } from "../_lib/employment-fields";
import { MoneyField, optionsOf, SelectField, TextAreaField, TextField } from "./form-field";
import type { StepProps } from "./step-types";

/**
 * The Income step: the chosen source's own fields, plus any field the
 * product requires or the server says is missing, whatever the source
 * (`visibleFields`), each marked required when it is asked for.
 */
export function StepEmployment({
  value: e,
  errors,
  onChange,
  requiredFields,
  missingFields,
}: StepProps<"employment"> & {
  /** The product's required fields, as the server has named them. */
  requiredFields: readonly string[];
  /** The server's `missing_fields` for the source it saved. */
  missingFields: Record<string, string>;
}) {
  const source = e.income_source;
  const shown = visibleFields(source, requiredFields, missingFields);
  const asked = askedFields(requiredFields, missingFields);
  const show = (field: string) => shown.has(field);
  const any = (fields: readonly string[]) => fields.some(show);
  /** Required by the source's own rule, or asked for whatever the source. */
  const needs = (field: string, ownRule: boolean) => ownRule || asked.has(field);
  const employed = source === "employed";
  const business = source === "self_employed" || source === "business_owner";
  const other = source === "farmer" || source === "pensioner" || source === "other";

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
      {any(EMPLOYED_FIELDS) && (
        <section className="grid gap-4 sm:grid-cols-2">
          {show("employer_name") && <TextField id="employer_name" label="Employer" required={needs("employer_name", employed)} value={e.employer_name} error={errors.employer_name} onChange={(employer_name) => onChange({ employer_name })} />}
          {show("job_title") && <TextField id="job_title" label="Job title" required={needs("job_title", employed)} value={e.job_title} error={errors.job_title} onChange={(job_title) => onChange({ job_title })} />}
          {show("employment_type") && <SelectField id="employment_type" label="Employment type" required={needs("employment_type", false)} options={EMPLOYMENT_TYPES} value={e.employment_type} error={errors.employment_type} onChange={(employment_type) => onChange({ employment_type })} />}
          {show("years_employed") && <TextField id="years_employed" label="Years with this employer" required={needs("years_employed", false)} inputMode="decimal" value={e.years_employed} error={errors.years_employed} onChange={(years_employed) => onChange({ years_employed })} />}
          {show("gross_monthly_income") && <MoneyField id="gross_monthly_income" label="Gross monthly pay" required={needs("gross_monthly_income", employed)} value={e.gross_monthly_income} error={errors.gross_monthly_income} onChange={(gross_monthly_income) => onChange({ gross_monthly_income })} />}
          {show("net_monthly_income") && <MoneyField id="net_monthly_income" label="Take-home pay a month" required={needs("net_monthly_income", false)} hint="After tax and deductions." value={e.net_monthly_income} error={errors.net_monthly_income} onChange={(net_monthly_income) => onChange({ net_monthly_income })} />}
          {show("salary_frequency") && <SelectField id="salary_frequency" label="Paid" required={needs("salary_frequency", employed)} options={optionsOf(FREQUENCY_LABELS)} value={e.salary_frequency} error={errors.salary_frequency} onChange={(v) => onChange({ salary_frequency: v as IncomeFrequency | "" })} />}
          {show("employer_address") && <TextField id="employer_address" label="Employer address" required={needs("employer_address", false)} value={e.employer_address} error={errors.employer_address} onChange={(employer_address) => onChange({ employer_address })} />}
        </section>
      )}
      {any(BUSINESS_FIELDS) && (
        <section className="grid gap-4 sm:grid-cols-2">
          {show("business_name") && <TextField id="business_name" label="Business name" required={needs("business_name", false)} value={e.business_name} error={errors.business_name} onChange={(business_name) => onChange({ business_name })} />}
          {show("business_type") && <TextField id="business_type" label="Type of business" required={needs("business_type", business)} placeholder="Sari-sari store" value={e.business_type} error={errors.business_type} onChange={(business_type) => onChange({ business_type })} />}
          {show("years_operating") && <TextField id="years_operating" label="Years in operation" required={needs("years_operating", false)} inputMode="decimal" value={e.years_operating} error={errors.years_operating} onChange={(years_operating) => onChange({ years_operating })} />}
          {show("business_address") && <TextField id="business_address" label="Business address" required={needs("business_address", false)} value={e.business_address} error={errors.business_address} onChange={(business_address) => onChange({ business_address })} />}
          {show("monthly_revenue") && <MoneyField id="monthly_revenue" label="Average sales a month" required={needs("monthly_revenue", business)} value={e.monthly_revenue} error={errors.monthly_revenue} onChange={(monthly_revenue) => onChange({ monthly_revenue })} />}
          {show("monthly_business_expenses") && <MoneyField id="monthly_business_expenses" label="Business costs a month" required={needs("monthly_business_expenses", false)} value={e.monthly_business_expenses} error={errors.monthly_business_expenses} onChange={(monthly_business_expenses) => onChange({ monthly_business_expenses })} />}
          {show("monthly_net_business_income") && <MoneyField id="monthly_net_business_income" label="Net income a month" required={needs("monthly_net_business_income", false)} hint="Leave empty and we use sales less costs." value={e.monthly_net_business_income} error={errors.monthly_net_business_income} onChange={(monthly_net_business_income) => onChange({ monthly_net_business_income })} />}
        </section>
      )}
      {any(OTHER_SOURCE_FIELDS) && (
        <section className="grid gap-4 sm:grid-cols-2">
          {show("other_source_description") && <TextField id="other_source_description" label="Source of income" required={needs("other_source_description", other)} className="sm:col-span-2" placeholder={source === "farmer" ? "Rice farming, 2 hectares" : source === "pensioner" ? "SSS pension" : ""} value={e.other_source_description} error={errors.other_source_description} onChange={(other_source_description) => onChange({ other_source_description })} />}
          {show("other_income_amount") && <MoneyField id="other_income_amount" label="Amount received" required={needs("other_income_amount", other)} value={e.other_income_amount} error={errors.other_income_amount} onChange={(other_income_amount) => onChange({ other_income_amount })} />}
          {show("other_income_frequency") && <SelectField id="other_income_frequency" label="Received" required={needs("other_income_frequency", other)} options={optionsOf(FREQUENCY_LABELS)} value={e.other_income_frequency} error={errors.other_income_frequency} onChange={(v) => onChange({ other_income_frequency: v as IncomeFrequency | "" })} />}
          {show("other_income_details") && <TextAreaField id="other_income_details" label="Details" required={needs("other_income_details", false)} className="sm:col-span-2" value={e.other_income_details} error={errors.other_income_details} onChange={(other_income_details) => onChange({ other_income_details })} />}
        </section>
      )}
      {show("other_regular_income") && (
        <MoneyField id="other_regular_income" label="Other regular income a month" required={needs("other_regular_income", false)} hint="Remittances, rent received, allowances." value={e.other_regular_income} error={errors.other_regular_income} onChange={(other_regular_income) => onChange({ other_regular_income })} />
      )}
      {source && (
        <p className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">We confirm your income against your documents when we review your application.</p>
      )}
    </div>
  );
}
