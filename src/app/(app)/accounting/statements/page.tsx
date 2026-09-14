import { RouteGuard } from "@/components/common";
import { AccountingPageHeader } from "../_components/page-header";
import { AwaitingBackend } from "../_components/awaiting-backend";

export default function FinancialStatementsPage() {
  return (
    <RouteGuard permission="accounting:view" pageName="Financial Statements">
      <div className="space-y-6">
        <AccountingPageHeader
          title="Financial Statements"
          description="Balance Sheet, Income Statement, Cash Flow and Changes in Equity."
        />
        <AwaitingBackend
          summary="The four statements, each over a chosen period and branch. All four read the same posted journals — none of them recalculates its own version of the figures."
          endpoints={[
            "GET /accounting/statements/balance-sheet",
            "GET /accounting/statements/income-statement",
            "GET /accounting/statements/cash-flow",
            "GET /accounting/statements/equity-changes",
          ]}
        />
      </div>
    </RouteGuard>
  );
}
