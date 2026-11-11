"use client";

import { CdaPage } from "../_components/cda-page";
import { Documents } from "./_components/documents";

export default function Page() {
  return (
    <CdaPage
      title="Compliance Documents"
      description="The year's compliance documents and every version of each. Restricted papers show only with their view."
    >
      {(ctx) => ctx && <Documents key={ctx.year} year={ctx.year} />}
    </CdaPage>
  );
}
