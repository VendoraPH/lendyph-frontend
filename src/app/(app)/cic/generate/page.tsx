"use client";

import { GenerateWizard } from "./_components/generate-wizard";
import { CicGuard } from "../_components/cic-guard";

/** A standard file. A correction has its own page, /cic/corrections/new?corrects=ID. */
export default function CicGeneratePage() {
  return (
    <CicGuard permission="cic:prepare" pageName="Generate Report">
      <GenerateWizard correctsId={null} />
    </CicGuard>
  );
}
