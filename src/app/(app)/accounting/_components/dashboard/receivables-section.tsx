import { AlertTriangle, ArrowLeftRight, CalendarClock, Clock, ShieldMinus, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatValue } from "@/lib/report-format";
import type { AccountingDashboard } from "@/types";
import { clearingNeedsReview } from "../../_lib/dashboard-figures";
import { FigureCard, FigureSection } from "./figure-card";

type ReceivableFields = Pick<
  AccountingDashboard,
  | "loans_receivable_gross"
  | "allowance_for_credit_losses"
  | "unearned_restructure_income"
  | "loans_receivable_net"
  | "past_due"
  | "adjustments_clearing"
  | "adjustments_clearing_needs_review"
>;

/** Loans receivable from the books, past due from the loan records. Every figure is the server's. */
export function ReceivablesSection({ data }: { data: ReceivableFields }) {
  const pastDue = data.past_due;
  return (
    <FigureSection title="Receivables" className="sm:grid-cols-2 lg:grid-cols-3">
      <FigureCard label="Loans receivable, gross" value={data.loans_receivable_gross} icon={Wallet} />
      <FigureCard
        label="Allowance for credit losses"
        value={data.allowance_for_credit_losses}
        icon={ShieldMinus}
      />
      <FigureCard
        label="Unearned income on restructured loans"
        value={data.unearned_restructure_income}
        icon={Clock}
      />
      <FigureCard
        label="Loans receivable, net"
        value={data.loans_receivable_net}
        icon={Wallet}
        caption="Gross, less the allowance and the unearned income."
      />
      <FigureCard
        label="Past due"
        value={pastDue?.amount}
        icon={CalendarClock}
        caption={
          <>
            Past due today, from the loan records
            {pastDue ? ` (${formatValue(pastDue.as_of, "date")})` : ""}
            {typeof pastDue?.count === "number"
              ? ` · ${pastDue.count} ${pastDue.count === 1 ? "loan" : "loans"}`
              : ""}
          </>
        }
      />
      <FigureCard
        label="Adjustments clearing"
        value={data.adjustments_clearing}
        icon={ArrowLeftRight}
        caption="Should be ₱0.00 once every balance adjustment is settled."
        badge={
          clearingNeedsReview(data.adjustments_clearing_needs_review) ? (
            <Badge variant="outline" className="border-amber-500/60 text-amber-700">
              <AlertTriangle className="mr-1 h-3 w-3" aria-hidden="true" />
              Needs review
            </Badge>
          ) : null
        }
      />
    </FigureSection>
  );
}
