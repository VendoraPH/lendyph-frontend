"use client";

import { RouteGuard } from "@/components/common/route-guard";
import { FillSection, PageFill } from "@/components/common/page-fill";
import { AmlaLogTab } from "../../settings/amla/_components/amla-log-tab";

/**
 * Audit & Compliance History: AMLA's own log (`GET /amla/log`), with
 * `amla:audit` and every branch, through the same viewer as Settings → AMLA.
 */
export default function AmlaHistoryPage() {
  return (
    <RouteGuard permission="amla:audit" pageName="Audit & Compliance History">
      <RouteGuard permission="branches:view_all" pageName="Audit & Compliance History">
        <PageFill>
          <div className="shrink-0">
            <h1 className="text-2xl font-semibold tracking-tight">Audit &amp; Compliance History</h1>
            <p className="text-sm text-muted-foreground">
              Every AMLA change, decision, approval, filing step, view and export, kept forever and apart from the main audit
              trail.
            </p>
          </div>
          <FillSection>
            <AmlaLogTab />
          </FillSection>
        </PageFill>
      </RouteGuard>
    </RouteGuard>
  );
}
