import { RouteGuard } from "@/components/common";
import { AccountingPageHeader } from "../_components/page-header";
import { AwaitingBackend } from "../_components/awaiting-backend";

export default function CashAndBankPage() {
  return (
    <RouteGuard permission="cash_accounts:view" pageName="Cash & Bank">
      <div className="space-y-6">
        <AccountingPageHeader
          title="Cash & Bank"
          description="Cash on hand, bank accounts, GCash and Maya."
        />
        <AwaitingBackend
          summary="Balances per money account and movement between them. A transfer between your own accounts is an asset-to-asset move, never income — only a charge on the transfer is an expense."
          endpoints={[
            "GET /accounting/cash-accounts",
            "POST /accounting/cash-accounts/transfer",
          ]}
        />
      </div>
    </RouteGuard>
  );
}
