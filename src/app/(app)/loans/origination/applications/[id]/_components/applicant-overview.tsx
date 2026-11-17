import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  FREQUENCY_LABELS,
  INCOME_SOURCE_LABELS,
  declaredMonthlyIncome,
  monthlyDebtPayments,
  monthlyExpenses,
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
          {shown.map(([label, value]) => (
            <div key={label}>
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

/** What the applicant entered, read-only. Totals here are the declared figures, labelled as such. */
export function ApplicantOverview({ application: a }: { application: ApplicationDetail }) {
  const { personal: p, employment: e, expenses: x, loan: l } = a.draft;
  const name = [p.first_name, p.middle_name, p.last_name, p.suffix].filter(Boolean).join(" ");
  const address = [p.street_address, p.barangay, p.city, p.province, p.region, p.postal_code].filter(Boolean).join(", ");
  const employed = e.income_source === "employed";
  const business = e.income_source === "self_employed" || e.income_source === "business_owner";
  const income = declaredMonthlyIncome(e);
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Section
        title="Applicant"
        rows={[
          ["Name", name],
          ["Date of birth", p.date_of_birth ? formatDate(p.date_of_birth) : null],
          ["Gender", p.gender],
          ["Civil status", p.civil_status],
          ["Mobile", a.mobile],
          ["Email", a.email],
          ["Address", address],
          ["Years at address", p.years_at_residence],
          ["Residence", p.residence_ownership],
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
          ["Payment frequency", l.frequency],
          ["Purpose", l.purpose],
          ["Release method", l.release_method],
        ]}
      />
      <Section
        title="Income"
        rows={[
          ["Source", e.income_source ? INCOME_SOURCE_LABELS[e.income_source] : null],
          ["Employer", employed ? e.employer_name : undefined],
          ["Position", employed ? e.job_title : undefined],
          ["Employment type", employed ? e.employment_type : undefined],
          ["Years employed", employed ? e.years_employed : undefined],
          ["Gross monthly income", employed ? peso(e.gross_monthly_income) : undefined],
          ["Net monthly income", employed ? peso(e.net_monthly_income) : undefined],
          ["Salary frequency", employed && e.salary_frequency ? FREQUENCY_LABELS[e.salary_frequency] : undefined],
          ["Business", business ? e.business_name : undefined],
          ["Business type", business ? e.business_type : undefined],
          ["Years operating", business ? e.years_operating : undefined],
          ["Monthly revenue", business ? peso(e.monthly_revenue) : undefined],
          ["Monthly net business income", business ? peso(e.monthly_net_business_income) : undefined],
          ["Other source", !employed && !business ? e.other_source_description : undefined],
          ["Declared monthly income", e.income_source ? formatCurrency(income) : null],
        ]}
      />
      <Section
        title="Expenses and debts"
        rows={[
          ["Declared monthly expenses", formatCurrency(monthlyExpenses(x))],
          ["Declared monthly debt payments", formatCurrency(monthlyDebtPayments(x))],
          ["Existing loans", x.has_existing_loans === null ? null : x.has_existing_loans ? `${x.existing_loans.length}` : "None"],
          ...x.existing_loans.map(
            (d, i): Row => [`Loan ${i + 1}: ${d.institution || "Unnamed lender"}`, peso(d.payment_amount)],
          ),
        ]}
      />
    </div>
  );
}
