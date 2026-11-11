"use client";

import { useState, type ReactNode } from "react";
import { REPORT_PAGES } from "../_lib/labels";
import { CdaPage, type CdaPageContext } from "./cda-page";
import { ReportWorkspace } from "./report-workspace";
import type { CdaReportType } from "@/types/cda";

/**
 * A report type's page: the CDA frame (with the type's restricted view, if it
 * has one) and the report for the chosen year, with any register or figures
 * the page shows above it.
 */
export function ReportPage({
  type,
  children,
}: {
  type: CdaReportType;
  /**
   * `reportChanged` reads the report again after a register write, so it shows
   * Refresh, and keeps the unsaved report edits.
   */
  children?: (ctx: CdaPageContext, reportChanged: () => void) => ReactNode;
}) {
  const page = REPORT_PAGES[type];
  const [version, setVersion] = useState(0);
  const reportChanged = () => setVersion((v) => v + 1);
  return (
    <CdaPage title={page.title} description={page.description} restriction={page.restriction}>
      {(ctx) =>
        ctx && (
          <div className="space-y-6">
            {children?.(ctx, reportChanged)}
            <ReportWorkspace key={ctx.year} registerVersion={version} year={ctx.year} type={type} />
          </div>
        )
      }
    </CdaPage>
  );
}
