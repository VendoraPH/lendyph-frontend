import Link from "next/link";
import { FilePenLine } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { SavingsDashboardKpis } from "@/types/savings-insight";
import { MISSING_REFERENCE_HREF, missingReferenceCountText } from "../../_lib/payout-reference";

/**
 * The server's count of non-cash payouts still without a reference (finish run
 * round 6), linking to that list on Savings Transactions. Shown only while
 * some are missing; the screen never counts them itself.
 */
export function MissingReferenceNotice({ kpis }: { kpis: SavingsDashboardKpis }) {
  const count = kpis.payouts_missing_reference;
  const text = missingReferenceCountText(count);
  if (!text || !count) return null;

  return (
    <Card className="border-2 border-amber-500/60" role="status">
      <CardContent className="flex flex-wrap items-center gap-3 py-4">
        <FilePenLine className="h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />
        <p className="min-w-0 flex-1 font-medium">{text}</p>
        <Link href={MISSING_REFERENCE_HREF} className="text-sm font-medium text-primary hover:underline">
          Open payouts missing a reference
        </Link>
      </CardContent>
    </Card>
  );
}
