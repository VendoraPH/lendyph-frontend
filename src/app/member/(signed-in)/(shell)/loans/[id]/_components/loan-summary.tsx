import { DetailList } from "@/components/portal/detail-list";
import { Money } from "@/components/portal/money";
import { SectionCard } from "@/components/portal/section-card";
import { formatDate } from "@/lib/format";
import { FREQUENCY, INTEREST_METHOD, NONE, TERM_UNIT, labelOf } from "@/lib/portal/labels";
import type { LoanDetail } from "@/lib/portal/types";
import { penaltyMonthsText, rateText } from "@/lib/portal/words";

const date = (value: string | null) => (value ? formatDate(value) : NONE);

/**
 * The loan's figures, each one the server's loan summary (round fz wording):
 * "Outstanding" is everything owed, "Principal Balance" the principal only,
 * "Total Paid" all money received for the loan.
 */
export function LoanSummary({ loan }: { loan: LoanDetail }) {
  const penaltyNote = penaltyMonthsText(loan.penalty_months);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <SectionCard title="What you owe">
        <DetailList
          items={[
            { label: "Outstanding", value: <Money value={loan.total_outstanding} />, strong: true },
            { label: "Principal Balance", value: <Money value={loan.outstanding_principal} /> },
            { label: "Interest Balance", value: <Money value={loan.outstanding_interest} /> },
            {
              label: "Penalty Balance",
              value: (
                <>
                  <Money value={loan.outstanding_penalty} />
                  {penaltyNote && <span className="block text-xs text-destructive">{penaltyNote}</span>}
                </>
              ),
            },
            { label: "Insurance premium owed", value: <Money value={loan.insurance_owed} /> },
            { label: "Past Due", value: <Money value={loan.overdue_amount} /> },
            {
              label: "Next due",
              value: loan.next_due_date ? (
                <>
                  <Money value={loan.next_due_amount} /> on {formatDate(loan.next_due_date)}
                </>
              ) : (
                NONE
              ),
            },
          ]}
        />
      </SectionCard>
      <SectionCard title="Paid so far">
        <DetailList
          items={[
            { label: "Total Paid", value: <Money value={loan.total_repaid} />, strong: true },
            { label: "Principal Paid", value: <Money value={loan.principal_paid} /> },
            { label: "Interest Paid", value: <Money value={loan.interest_paid} /> },
            { label: "Penalty Paid", value: <Money value={loan.penalty_paid} /> },
            { label: "Principal paid so far", value: `${loan.paid_percent}%` },
          ]}
        />
      </SectionCard>
      <SectionCard title="Loan terms">
        <DetailList
          items={[
            { label: "Loan amount", value: <Money value={loan.principal_amount} /> },
            { label: "Term", value: loan.term ? `${loan.term} ${labelOf(TERM_UNIT, loan.term_unit)}` : NONE },
            { label: "Payments", value: labelOf(FREQUENCY, loan.frequency) },
            { label: "Interest rate", value: rateText(loan.interest_rate, loan.interest_rate_frequency) },
            { label: "Interest method", value: labelOf(INTEREST_METHOD, loan.interest_method) },
            { label: "Released on", value: date(loan.release_date) },
            { label: "Matures on", value: date(loan.maturity_date) },
          ]}
        />
      </SectionCard>
    </div>
  );
}
