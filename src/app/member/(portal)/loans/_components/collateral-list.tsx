import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { humanize } from "@/lib/portal/labels";
import type { PortalCollateral } from "@/types/portal";
import { DetailItem } from "../../../_components/detail-item";

/**
 * The collateral pledged for this loan. Member-safe: the server sends no
 * internal notes, and leaves `appraised_value` null when valuations are not shown.
 */
export function CollateralList({ collaterals, loanNumber }: { collaterals: PortalCollateral[]; loanNumber: string }) {
  if (collaterals.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">No collateral is pledged for this loan.</p>;
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {collaterals.map((c) => (
        <Card key={c.id}>
          <CardContent className="p-4">
            <p className="font-medium">{humanize(c.type)}</p>
            <p className="mb-3 text-sm text-muted-foreground">{c.description}</p>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <DetailItem label="Reference" value={c.reference} />
              <DetailItem label="Status" value={c.status ? humanize(c.status) : null} />
              {c.appraised_value !== null && (
                <DetailItem label="Appraised value" value={formatCurrency(c.appraised_value)} />
              )}
              <DetailItem label="Secures loan" value={loanNumber} />
            </dl>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
