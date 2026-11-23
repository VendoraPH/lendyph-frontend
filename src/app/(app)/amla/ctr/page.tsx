"use client";

import { RouteGuard } from "@/components/common/route-guard";
import { PageFill } from "@/components/common/page-fill";
import { AMLA_CTR_READ } from "@/lib/amla/case-access";
import { FilingsList } from "../_components/filings-list";

/** A CTR reading key; the server lists CTRs in the caller's branches. */
export default function AmlaCtrPage() {
  return (
    <RouteGuard permission={[...AMLA_CTR_READ]} pageName="Covered Transactions (CTR)">
      <PageFill>
        <div className="shrink-0">
          <h1 className="text-2xl font-semibold tracking-tight">Covered Transactions (CTR)</h1>
          <p className="text-sm text-muted-foreground">
            CTRs prepared from CTR candidates. Each waits for approval by someone other than its preparer, then is filed by
            hand on the AMLC portal.
          </p>
        </div>
        <FilingsList type="ctr" idPrefix="amla-ctr" />
      </PageFill>
    </RouteGuard>
  );
}
