import { RouteGuard } from "@/components/common";
import { AccountingPageHeader } from "../_components/page-header";
import { AwaitingBackend } from "../_components/awaiting-backend";

export default function TrialBalancePage() {
  return (
    <RouteGuard permission="accounting:view" pageName="Trial Balance">
      <div className="space-y-6">
        <AccountingPageHeader
          title="Trial Balance"
          description="Every account's balance, and proof they agree."
        />
        <AwaitingBackend
          summary="All account balances as at a date, with total debits and total credits. They must be equal — where they are not, something has been posted that should not have been."
          endpoints={[
            "GET /accounting/trial-balance",
          ]}
        />
      </div>
    </RouteGuard>
  );
}
