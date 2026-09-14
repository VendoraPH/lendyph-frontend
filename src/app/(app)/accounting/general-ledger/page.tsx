import { RouteGuard } from "@/components/common";
import { AccountingPageHeader } from "../_components/page-header";
import { AwaitingBackend } from "../_components/awaiting-backend";

export default function GeneralLedgerPage() {
  return (
    <RouteGuard permission="accounting:view" pageName="General Ledger">
      <div className="space-y-6">
        <AccountingPageHeader
          title="General Ledger"
          description="Every movement through a single account."
        />
        <AwaitingBackend
          summary="One account at a time, over a date range, with a running balance and a link back to the journal entry and the transaction behind each line."
          endpoints={[
            "GET /accounting/general-ledger",
          ]}
        />
      </div>
    </RouteGuard>
  );
}
