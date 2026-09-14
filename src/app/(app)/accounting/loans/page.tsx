import { RouteGuard } from "@/components/common";
import { AccountingPageHeader } from "../_components/page-header";
import { AwaitingBackend } from "../_components/awaiting-backend";

export default function LoanAccountingPage() {
  return (
    <RouteGuard permission="accounting:view" pageName="Loan Accounting">
      <div className="space-y-6">
        <AccountingPageHeader
          title="Loan Accounting"
          description="The portfolio as the books see it."
        />
        <AwaitingBackend
          summary="Loans receivable by age, the allowance for credit losses, and the reconciliation between the loan module's outstanding balance and the receivable accounts. The two should agree to the centavo; where they do not, this is the screen that shows it."
          endpoints={[
            "GET /accounting/loans/aging",
            "GET /accounting/trial-balance",
          ]}
        />
      </div>
    </RouteGuard>
  );
}
