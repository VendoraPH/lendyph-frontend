import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatCurrency, formatDate, formatRate } from "@/lib/format";
import { LOAN_STATUS, paidPercent, toAmount } from "@/lib/portal/finance";
import { humanize, TONE_CLASS } from "@/lib/portal/labels";
import type { PortalLoanDetail } from "@/types/portal";
import { DetailItem } from "../../../_components/detail-item";
import { StatusPill } from "../../../_components/portal-shell";

export function LoanSummaryCard({ loan, actions }: { loan: PortalLoanDetail; actions: React.ReactNode }) {
  const status = LOAN_STATUS[loan.status] ?? { label: loan.status, tone: "muted" as const };
  const pct = paidPercent(loan.total_paid, loan.total_payable);
  const pastDue = toAmount(loan.past_due_amount);

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
        <div className="space-y-1">
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            {loan.product_name}
            <StatusPill className={TONE_CLASS[status.tone]}>{status.label}</StatusPill>
          </CardTitle>
          <p className="text-xs text-muted-foreground">{loan.loan_number}</p>
        </div>
        <div className="flex flex-wrap gap-2">{actions}</div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Figure label="Outstanding balance" value={formatCurrency(loan.outstanding_balance)} strong />
          <Figure
            label="Next due"
            value={loan.next_due_date ? formatDate(loan.next_due_date) : "—"}
            note={loan.next_due_amount != null ? formatCurrency(loan.next_due_amount) : undefined}
          />
          <Figure label="Past due" value={formatCurrency(pastDue)} danger={pastDue > 0} />
          <Figure label="Penalties" value={formatCurrency(loan.penalty_balance)} />
        </div>
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              Paid {formatCurrency(loan.total_paid)} of {formatCurrency(loan.total_payable)}
            </span>
            <span>{pct}%</span>
          </div>
          <Progress value={pct} aria-label="Share of the loan paid" />
        </div>
        <dl className="grid grid-cols-1 gap-y-3 text-sm sm:grid-cols-3 sm:gap-x-6">
          <DetailItem label="Amount borrowed" value={formatCurrency(loan.principal)} />
          <DetailItem
            label="Interest"
            value={`${formatRate(loan.interest_rate)}% · ${humanize(loan.interest_method)}`}
          />
          <DetailItem
            label="Term"
            value={`${loan.term} ${loan.term_unit} · paid ${humanize(loan.frequency).toLowerCase()}`}
          />
          <DetailItem label="Released" value={loan.released_at ? formatDate(loan.released_at) : null} />
          <DetailItem label="Maturity" value={loan.maturity_date ? formatDate(loan.maturity_date) : null} />
          <DetailItem label="Co-makers" value={loan.co_makers.map((c) => c.name).join(", ")} />
        </dl>
        {loan.collaterals.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">Collateral</p>
            <ul className="divide-y text-sm">
              {loan.collaterals.map((c) => (
                <li key={c.id} className="flex flex-wrap justify-between gap-2 py-1.5">
                  <span>
                    {humanize(c.type)} · {c.description}
                  </span>
                  {c.appraised_value != null && (
                    <span className="text-muted-foreground">Appraised {formatCurrency(c.appraised_value)}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Figure({
  label,
  value,
  note,
  strong,
  danger,
}: {
  label: string;
  value: string;
  note?: string;
  strong?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-0.5 ${strong ? "text-lg font-semibold" : "font-medium"} ${danger ? "text-destructive" : ""}`}>
        {value}
      </p>
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}
