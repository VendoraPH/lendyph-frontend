"use client";

import { CdaPage } from "../_components/cda-page";
import { Submissions } from "./_components/submissions";

export default function Page() {
  return (
    <CdaPage
      title="Submission History"
      description="Where and when each report went to CDA, with its references, CDA's answer and the proof."
    >
      {(ctx) => ctx && <Submissions key={ctx.year} year={ctx.year} />}
    </CdaPage>
  );
}
