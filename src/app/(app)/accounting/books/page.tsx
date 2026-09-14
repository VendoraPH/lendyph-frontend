import { RouteGuard } from "@/components/common";
import { AccountingPageHeader } from "../_components/page-header";
import { AwaitingBackend } from "../_components/awaiting-backend";

export default function AccountingBooksPage() {
  return (
    <RouteGuard permission="accounting:view" pageName="Accounting Books">
      <div className="space-y-6">
        <AccountingPageHeader
          title="Accounting Books"
          description="The four books of account, in BIR format."
        />
        <AwaitingBackend
          summary="General Journal, General Ledger, Cash Receipts and Cash Disbursements, laid out for Philippine BIR reporting and export."
          endpoints={[
            "GET /accounting/books/general-journal",
            "GET /accounting/books/general-ledger",
            "GET /accounting/books/cash-receipts",
            "GET /accounting/books/cash-disbursements",
          ]}
        />
      </div>
    </RouteGuard>
  );
}
