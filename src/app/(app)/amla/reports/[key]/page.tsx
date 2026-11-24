"use client";

import { notFound, useParams } from "next/navigation";
import { ComplianceReportPage } from "../../_components/compliance-report-page";

const REPORT_KEY = /^[a-z_]{1,40}$/;

/** One AMLA report. The server checks the report's own key on every read and export. */
export default function AmlaReportPage() {
  const key = useParams().key;
  if (typeof key !== "string" || !REPORT_KEY.test(key)) notFound();
  return <ComplianceReportPage key={key} reportKey={key} />;
}
