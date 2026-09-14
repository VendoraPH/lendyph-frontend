import { RouteGuard } from "@/components/common";
import { AccountingPageHeader } from "../_components/page-header";
import { AwaitingBackend } from "../_components/awaiting-backend";

export default function JournalEntriesPage() {
  return (
    <RouteGuard permission="journals:view" pageName="Journal Entries">
      <div className="space-y-6">
        <AccountingPageHeader
          title="Journal Entries"
          description="Every entry in the books, automatic and manual."
        />
        <AwaitingBackend
          summary="The journal register: entries raised automatically by lending events alongside manual ones, with drafting, posting and reversal. A posted entry is never edited — reversing writes a second, mirrored entry and keeps both."
          endpoints={[
            "GET /accounting/journals",
            "POST /accounting/journals",
            "POST /accounting/journals/{id}/post",
            "POST /accounting/journals/{id}/reverse",
          ]}
        />
      </div>
    </RouteGuard>
  );
}
