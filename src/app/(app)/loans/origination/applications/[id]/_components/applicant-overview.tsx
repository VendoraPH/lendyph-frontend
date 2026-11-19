import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  EMPLOYMENT_TYPES,
  INCOME_SOURCE_LABELS,
  RELEASE_METHODS,
  declaredExpenseRows,
  declaredIncomeRows,
  inWords,
  parseAmount,
} from "@/lib/loan-origination";
import type { ApplicationDetail } from "@/types/loan-origination";

type Row = [label: string, value: string | null | undefined];

function Section({ title, rows }: { title: string; rows: Row[] }) {
  const shown = rows.filter(([, v]) => v !== undefined);
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          {shown.map(([label, value], i) => (
            <div key={`${i}-${label}`}>
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="break-words">{value || "—"}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

const peso = (v: string) => {
  const n = parseAmount(v);
  return n === null ? null : formatCurrency(n);
};

/** The server's assessment figure, or a dash when there is no assessment or no figure. */
const assessed = (v: number | null | undefined) => (typeof v === "number" ? formatCurrency(v) : null);

/**
 * What the applicant entered, read-only. Monthly totals are the server's
 * assessment figures; nothing is added up here.
 */
export function ApplicantOverview({ application: a }: { application: ApplicationDetail }) {
  const { personal: p, employment: e, expenses: x, loan: l } = a.draft;
  const name = [p.first_name, p.middle_name, p.last_name, p.suffix].filter(Boolean).join(" ");
  const address = [p.street_address, p.barangay, p.city, p.province, p.region, p.postal_code].filter(Boolean).join(", ");
  const employed = e.income_source === "employed";
  const business = e.income_source === "self_employed" || e.income_source === "business_owner";
  const figures = a.assessment?.figures;
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Section
        title="Applicant"
        rows={[
          ["Name", name],
          ["Date of birth", p.date_of_birth ? formatDate(p.date_of_birth) : null],
          ["Gender", inWords(p.gender)],
          ["Civil status", inWords(p.civil_status)],
          ["Mobile", a.mobile],
          ["Email", a.email],
          ["Address", address],
          ["Years at address", p.years_at_residence],
          ["Residence", inWords(p.residence_ownership)],
          ["Dependents", p.dependents],
          ["Membership number", p.membership_number],
        ]}
      />
      <Section
        title="Loan requested"
        rows={[
          ["Loan product", a.loan_product_name],
          ["Amount", peso(l.amount)],
          ["Term", l.term],
          ["Payment frequency", inWords(l.frequency)],
          ["Purpose", l.purpose],
          ["Release method", inWords(l.release_method, RELEASE_METHODS)],
        ]}
      />
      <Section
        title="Income"
        rows={[
          ["Source", e.income_source ? INCOME_SOURCE_LABELS[e.income_source] : null],
          ["Employer", employed ? e.employer_name : undefined],
          ["Position", employed ? e.job_title : undefined],
          ["Employment type", employed ? inWords(e.employment_type, EMPLOYMENT_TYPES) : undefined],
          ["Years employed", employed ? e.years_employed : undefined],
          ...declaredIncomeRows(e),
          ["Business", business ? e.business_name : undefined],
          ["Business type", business ? e.business_type : undefined],
          ["Years operating", business ? e.years_operating : undefined],
          ["Other source", !employed && !business && e.income_source ? e.other_source_description : undefined],
          ["Declared monthly income (assessment)", assessed(figures?.declared_monthly_income)],
        ]}
      />
      <Section
        title="Expenses and debts"
        rows={[
          ["Existing loans", x.has_existing_loans === null ? null : x.has_existing_loans ? `${x.existing_loans.length}` : "None"],
          ...declaredExpenseRows(x),
          ["Monthly expenses (assessment)", assessed(figures?.monthly_expenses)],
          ["Monthly debt payments (assessment)", assessed(figures?.monthly_debt_payments)],
        ]}
      />
    </div>
  );
}
