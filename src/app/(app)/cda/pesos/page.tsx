"use client";

import { ReportPage } from "../_components/report-page";
import { PesosAssessment } from "./_components/assessment";

export default function Page() {
  return <ReportPage type="pesos">{(ctx) => <PesosAssessment key={ctx.year} year={ctx.year} />}</ReportPage>;
}
