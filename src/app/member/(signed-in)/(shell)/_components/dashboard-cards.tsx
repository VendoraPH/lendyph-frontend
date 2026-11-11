import { Money } from "@/components/portal/money";
import { StatCard } from "@/components/portal/stat-card";
import { formatDate } from "@/lib/format";
import type { Dashboard } from "@/lib/portal/types";
import { plural } from "@/lib/portal/words";

/**
 * The dashboard's figure cards. Each block is the server's, and a block the
 * cooperative switched off arrives as null and isn't shown. Wording follows
 * round fz: "Outstanding" is everything still owed.
 */
export function DashboardCards({ data }: { data: Dashboard }) {
  const { loans, next_payment, savings, time_deposits, share_capital } = data;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {loans && (
        <StatCard
          title="Loans: Outstanding"
          value={<Money value={loans.total_outstanding} />}
          lines={[
            { label: "Past Due", value: <Money value={loans.overdue_amount} /> },
            { label: "Active loans", value: loans.active_count },
          ]}
          href="/member/loans"
          linkText="See loans"
        />
      )}
      {next_payment && (
        <StatCard
          title="Next payment"
          value={<Money value={next_payment.amount} />}
          lines={[
            { label: "Due on", value: formatDate(next_payment.due_date) },
            { label: "On", value: plural(next_payment.loans_count, "loan") },
          ]}
          href="/member/loans"
          linkText="See loans"
        />
      )}
      {savings && (
        <StatCard
          title="Savings balance"
          value={<Money value={savings.total} />}
          lines={[
            { label: "Available", value: <Money value={savings.available} /> },
            { label: "Accounts", value: savings.accounts },
          ]}
          href="/member/savings"
          linkText="See savings"
        />
      )}
      {time_deposits && (
        <StatCard
          title="Time deposits"
          value={<Money value={time_deposits.total} />}
          lines={[{ label: "Placements", value: time_deposits.count }]}
          href="/member/savings#time-deposits"
          linkText="See time deposits"
        />
      )}
      {share_capital && (
        <StatCard
          title="Share capital (paid up)"
          value={<Money value={share_capital.paid_up} />}
          href="/member/share-capital"
          linkText="See share capital"
        />
      )}
    </div>
  );
}
