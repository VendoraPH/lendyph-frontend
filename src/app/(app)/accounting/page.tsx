import { RouteGuard } from "@/components/common";
import { AccountingPageHeader } from "./_components/page-header";
import { AwaitingBackend } from "./_components/awaiting-backend";

export default function AccountingDashboardPage() {
  return (
    <RouteGuard permission="accounting:view" pageName="Accounting">
      <div className="space-y-6">
        <AccountingPageHeader
          title="Accounting"
          description="Balances, period results and anything the books need attention on."
        />
        <AwaitingBackend
          summary="A summary of cash and bank balances, the period's income and expenses, receivables and anything unposted — filtered by branch and period."
          endpoints={[
            "GET /accounting/trial-balance",
            "GET /accounting/cash-accounts",
            "GET /accounting/loans/aging",
            "GET /accounting/journals",
          ]}
        />
      </div>
    </RouteGuard>
  );
}
