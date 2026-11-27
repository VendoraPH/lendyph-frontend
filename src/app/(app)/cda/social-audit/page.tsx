"use client";

import { ReportPage } from "../_components/report-page";
import { SocialPrograms } from "./_components/programs";

export default function Page() {
  return (
    <ReportPage type="social_audit">
      {(ctx, reportChanged) => <SocialPrograms key={ctx.year} year={ctx.year} onChanged={reportChanged} />}
    </ReportPage>
  );
}
