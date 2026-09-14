import { RouteGuard } from "@/components/common";
import { AccountingPageHeader } from "../_components/page-header";
import { AwaitingBackend } from "../_components/awaiting-backend";

export default function ReconciliationPage() {
  return (
    <RouteGuard permission="accounting:reconcile" pageName="Reconciliation">
      <div className="space-y-6">
        <AccountingPageHeader
          title="Reconciliation"
          description="Matching the books against an external statement."
        />
        <AwaitingBackend
          summary="Comparing a cash, bank or wallet account against its real statement and matching line by line. A transaction that appears externally but not in the books is flagged for a person to classify — it is never auto-posted as lending income."
          endpoints={[
            "GET /accounting/reconciliations",
            "POST /accounting/reconciliations",
            "POST /accounting/reconciliations/{id}/match",
          ]}
        />
      </div>
    </RouteGuard>
  );
}
