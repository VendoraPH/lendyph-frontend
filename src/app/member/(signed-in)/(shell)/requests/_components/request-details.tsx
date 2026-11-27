import { DetailList, type DetailItem } from "@/components/portal/detail-list";
import { Money } from "@/components/portal/money";
import { formatDate } from "@/lib/format";
import { NONE, PAYOUT_METHOD, labelOf } from "@/lib/portal/labels";
import type { RequestDetail } from "@/lib/portal/types";

/** A request's details by type, as the server sends them (payout numbers and profile values masked). */
export function RequestDetails({ request }: { request: RequestDetail }) {
  const d = request.details;
  const items: DetailItem[] = [{ label: "Summary", value: request.summary }];

  if (request.type === "savings_withdrawal") {
    items.push(
      { label: "From account", value: d.account_number ?? NONE },
      { label: "Amount", value: <Money value={request.amount} />, strong: true },
      { label: "Receive it by", value: labelOf(PAYOUT_METHOD, d.method) },
    );
    if (d.payout?.bank_name) items.push({ label: "Bank", value: d.payout.bank_name });
    if (d.payout?.account_name) items.push({ label: "Account name", value: d.payout.account_name });
    if (d.payout?.account_number) items.push({ label: "Account number", value: d.payout.account_number });
    if (d.payout?.gcash_number) items.push({ label: "GCash number", value: d.payout.gcash_number });
  } else if (request.type === "savings_opening") {
    items.push(
      { label: "Product", value: d.product_name ?? NONE },
      { label: "Opening deposit", value: <Money value={d.initial_deposit} />, strong: true },
    );
  }
  if (request.expires_on) items.push({ label: "Open until", value: formatDate(request.expires_on) });

  return (
    <div className="space-y-4">
      <DetailList items={items} className="sm:grid-cols-1" />
      {request.type === "profile_update" && d.changes && d.changes.length > 0 && (
        <ul className="divide-y rounded-lg border">
          {d.changes.map((change) => (
            <li key={change.field} className="p-2.5 text-sm">
              <p className="font-medium">{change.label}</p>
              <p className="text-xs text-muted-foreground">
                From {change.current ?? NONE} to <span className="text-foreground">{change.requested ?? NONE}</span>
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
