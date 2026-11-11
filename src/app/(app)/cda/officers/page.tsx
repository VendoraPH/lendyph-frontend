"use client";

import { ReportPage } from "../_components/report-page";
import { OfficerRegisters } from "./_components/registers";

export default function Page() {
  return (
    <ReportPage type="officers_trainings">
      {(ctx, reportChanged) => <OfficerRegisters key={ctx.year} year={ctx.year} onChanged={reportChanged} />}
    </ReportPage>
  );
}
