// src/app/(app)/credit-scoring/borrowers/[id]/_components/cic-placeholder.tsx

import { Link2Off } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

/**
 * External CIC (Credit Information Corporation) bureau data is a future
 * integration. Never label anything here as live bureau data — that is a
 * regulatory and trust problem, not just a UI bug.
 */
export function CicPlaceholder() {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center gap-2 py-8 text-center">
        <Link2Off className="h-6 w-6 text-muted-foreground" />
        <p className="text-sm font-medium">External Credit Bureau (CIC)</p>
        <p className="max-w-xs text-sm text-muted-foreground">
          Not connected. This score is based on Lendy&apos;s internal data only.
        </p>
      </CardContent>
    </Card>
  );
}
