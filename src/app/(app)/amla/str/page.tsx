"use client";

import { RouteGuard } from "@/components/common/route-guard";
import { PageFill } from "@/components/common/page-fill";
import { AMLA_STR_READ } from "@/lib/amla/case-access";
import { FilingsList } from "../_components/filings-list";

/** An STR reading key with every branch, as `GET /amla/reports` reads STRs. */
export default function AmlaStrPage() {
  return (
    <RouteGuard permission={[...AMLA_STR_READ]} pageName="Suspicious Transactions (STR)">
      <RouteGuard permission="branches:view_all" pageName="Suspicious Transactions (STR)">
        <PageFill>
          <div className="shrink-0">
            <h1 className="text-2xl font-semibold tracking-tight">Suspicious Transactions (STR)</h1>
            <p className="text-sm text-muted-foreground">
              STRs prepared from cases whose authorized decision established suspicion. An alert alone never becomes an STR,
              and the preparer never approves their own.
            </p>
          </div>
          <FilingsList type="str" idPrefix="amla-str" />
        </PageFill>
      </RouteGuard>
    </RouteGuard>
  );
}
