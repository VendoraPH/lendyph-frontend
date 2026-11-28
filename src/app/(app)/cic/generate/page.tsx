"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { PageLoader } from "@/components/common/page-fill";
import { GenerateWizard } from "./_components/generate-wizard";
import { CicGuard } from "../_components/cic-guard";

/** `?corrects=ID` prepares a correction file for that submission. */
function GenerateContent() {
  const raw = useSearchParams().get("corrects") ?? "";
  const correctsId = /^\d{1,18}$/.test(raw) && Number(raw) > 0 ? Number(raw) : null;
  return <GenerateWizard key={correctsId ?? "new"} correctsId={correctsId} />;
}

export default function CicGeneratePage() {
  return (
    <CicGuard permission="cic:prepare" pageName="Generate Report">
      <Suspense fallback={<PageLoader />}>
        <GenerateContent />
      </Suspense>
    </CicGuard>
  );
}
