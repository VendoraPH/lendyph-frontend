import { RouteGuard } from "@/components/common";
import { AccountingPageHeader } from "../_components/page-header";
import { AwaitingBackend } from "../_components/awaiting-backend";

export default function AccountingSettingsPage() {
  return (
    <RouteGuard permission="accounting:settings" pageName="Accounting Settings">
      <div className="space-y-6">
        <AccountingPageHeader
          title="Accounting Settings"
          description="Fiscal year, posting map and opening balances."
        />
        <AwaitingBackend
          summary="The fiscal year, and the mapping that decides which account each automatic posting lands in — so an organisation can re-point 'interest income' at its own account without anyone changing a posting rule. Opening balances are entered here too, and must balance before they can be finalised."
          endpoints={[
            "GET /accounting/settings",
            "GET /accounting/settings/account-mapping",
            "PUT /accounting/settings/account-mapping",
            "POST /accounting/opening-balances",
          ]}
        />
      </div>
    </RouteGuard>
  );
}
