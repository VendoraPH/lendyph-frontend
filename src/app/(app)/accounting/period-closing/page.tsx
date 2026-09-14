import { RouteGuard } from "@/components/common";
import { AccountingPageHeader } from "../_components/page-header";
import { AwaitingBackend } from "../_components/awaiting-backend";

export default function PeriodClosingPage() {
  return (
    <RouteGuard permission="accounting:close" pageName="Period Closing">
      <div className="space-y-6">
        <AccountingPageHeader
          title="Period Closing"
          description="Locking a month or year once it is final."
        />
        <AwaitingBackend
          summary="Closing a period so nothing further can be posted into it, after checking that the trial balance agrees and nothing is left in draft. Reopening is possible but recorded."
          endpoints={[
            "GET /accounting/periods",
            "POST /accounting/periods/{id}/close",
            "POST /accounting/periods/{id}/reopen",
          ]}
        />
      </div>
    </RouteGuard>
  );
}
