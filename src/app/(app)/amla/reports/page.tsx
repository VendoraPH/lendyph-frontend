"use client";

import { ComplianceReportCatalog } from "../_components/compliance-report-catalog";

/** AMLA Compliance → AMLA Reports. The /amla layout needs `amla:view`; the server lists only the reports the caller may open. */
export default function AmlaReportsPage() {
  return <ComplianceReportCatalog />;
}
