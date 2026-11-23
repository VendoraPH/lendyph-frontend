import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/format";
import { EMPLOYMENT_TYPES, FREQUENCY_LABELS, INCOME_SOURCE_LABELS, RELEASE_METHODS, inWords } from "@/lib/loan-origination";
import type { ApplicationDetail, DeclaredLine, IncomeFrequency } from "@/types/loan-origination";
import { termText } from "../../../_lib/term";

type Row = [label: string, value: string | null | undefined];

function Section({ title, rows, children }: { title: string; rows: Row[]; children?: React.ReactNode }) {
  const shown = rows.filter(([, v]) => v !== undefined);
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {shown.length > 0 && (
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            {shown.map(([label, value], i) => (
              <div key={`${i}-${label}`}>
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="break-words">{value || "—"}</dd>
              </div>
            ))}
          </dl>
        )}
        {children}
      </CardContent>
    </Card>
  );
}

/** The server's monthly lines and their total, as `declared_totals` sends them. */
function Monthly({ lines, total, totalLabel, empty }: { lines: DeclaredLine[]; total: string | null; totalLabel: string; empty: string }) {
  return (
    <dl className="text-sm">
      {lines.length === 0 && <p className="text-muted-foreground">{empty}</p>}
      {lines.map((l) => (
        <div key={l.key} className="flex justify-between gap-3 border-b border-dashed py-1">
          <dt className="text-muted-foreground">{l.label}</dt>
          <dd className="tabular-nums">{formatCurrency(l.monthly)}</dd>
        </div>
      ))}
      <div className="flex justify-between gap-3 py-1 font-medium">
        <dt>{totalLabel}</dt>
        <dd className="tabular-nums">{total === null ? "—" : formatCurrency(total)}</dd>
      </div>
    </dl>
  );
}

const frequency = (f: IncomeFrequency | "") => (f ? FREQUENCY_LABELS[f] : null);

/**
 * What the applicant entered, read-only. Monthly amounts and totals are the
 * server's `declared_totals`: each line converted to a month and added up on
 * the server. Without `borrowers:view` and the branch, contacts are masked and
 * address lines read "On file".
 */
export function ApplicantOverview({ application: a, termUnit }: { application: ApplicationDetail; termUnit?: string }) {
  const { personal: p, employment: e, expenses: x, loan: l } = a.draft;
  const totals = a.declared_totals;
  const name = [p.first_name, p.middle_name, p.last_name, p.suffix].filter(Boolean).join(" ");
  const address = [p.street_address, p.barangay, p.city, p.province, p.region, p.postal_code].filter(Boolean).join(", ");
  const employed = e.income_source === "employed";
  const business = e.income_source === "self_employed" || e.income_source === "business_owner";
  const loans = x.has_existing_loans ? x.existing_loans : [];

  return (
    <div className="space-y-4">
      {a.contacts_hidden && (
        <p className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
          The mobile number and email are masked and the address lines read &quot;On file&quot;: seeing them needs the
          permission to view members and access to the application&apos;s branch.
        </p>
      )}
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
            ["Branch", a.branch_name],
          ]}
        />
        <Section
          title="Loan requested"
          rows={[
            ["Loan product", a.loan_product_name],
            ["Amount", a.requested_amount === null ? null : formatCurrency(a.requested_amount)],
            ["Term", termText(a.requested_term, termUnit)],
            ["Payment frequency", inWords(l.frequency)],
            ["Purpose", l.purpose],
            ["Release method", inWords(l.release_method, RELEASE_METHODS)],
          ]}
        />
        <Section
          title="Income a month, as declared"
          rows={[
            ["Source", e.income_source ? INCOME_SOURCE_LABELS[e.income_source] : null],
            ["Employer", employed ? e.employer_name : undefined],
            ["Position", employed ? e.job_title : undefined],
            ["Employment type", employed ? inWords(e.employment_type, EMPLOYMENT_TYPES) : undefined],
            ["Years employed", employed ? e.years_employed : undefined],
            ["Paid", employed ? frequency(e.salary_frequency) : undefined],
            ["Business", business ? e.business_name : undefined],
            ["Business type", business ? e.business_type : undefined],
            ["Years operating", business ? e.years_operating : undefined],
            ["Other source", !employed && !business && e.income_source ? e.other_source_description : undefined],
            ["Received", !employed && !business && e.income_source ? frequency(e.other_income_frequency) : undefined],
          ]}
        >
          <Monthly lines={totals.income} total={totals.monthly_income} totalLabel="Monthly income" empty="No income declared." />
        </Section>
        <Section
          title="Expenses and debts a month, as declared"
          rows={[["Existing loans", x.has_existing_loans === null ? null : loans.length > 0 ? loans.map((d) => d.institution || "Unnamed lender").join(", ") : "None"]]}
        >
          <Monthly lines={totals.expenses} total={totals.monthly_expenses} totalLabel="Monthly expenses" empty="No expenses declared." />
          <Monthly lines={totals.debts} total={totals.monthly_debt_payments} totalLabel="Monthly debt payments" empty="No debt payments declared." />
          <div className="flex justify-between gap-3 border-t pt-2 text-sm font-medium">
            <span>Left after expenses and debts</span>
            <span className="tabular-nums">{totals.monthly_remaining === null ? "—" : formatCurrency(totals.monthly_remaining)}</span>
          </div>
        </Section>
      </div>
    </div>
  );
}
