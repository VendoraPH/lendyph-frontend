import { RouteGuard } from "@/components/common";
import { AccountingPageHeader } from "../_components/page-header";
import { AwaitingBackend } from "../_components/awaiting-backend";

export default function ExpensesPage() {
  return (
    <RouteGuard permission="expenses:view" pageName="Expenses & Payables">
      <div className="space-y-6">
        <AccountingPageHeader
          title="Expenses & Payables"
          description="Operating costs, paid and owed."
        />
        <AwaitingBackend
          summary="Recording expenses against a cash account or as a payable, and settling payables. Unpaid, partially paid, paid and overdue."
          endpoints={[
            "GET /accounting/expenses",
            "POST /accounting/expenses",
            "POST /accounting/expenses/{id}/pay",
          ]}
        />
      </div>
    </RouteGuard>
  );
}
