"use client";

import { CdaPage } from "../_components/cda-page";
import { LoanClassification } from "./_components/classification";

export default function Page() {
  return (
    <CdaPage
      title="Loan Classification"
      description="Loans by aging class with the allowance required, against the allowance booked. Read only."
    >
      {(ctx) => ctx && <LoanClassification key={ctx.year} year={ctx.year} />}
    </CdaPage>
  );
}
