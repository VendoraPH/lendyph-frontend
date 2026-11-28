"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PageFill, PageLoader } from "@/components/common/page-fill";
import { CicPageHeader } from "../../_components/page-header";
import { GenerateWizard } from "../../generate/_components/generate-wizard";
import { CicGuard } from "../../_components/cic-guard";

/** `?corrects=ID`: the correction file for that submission, built from a correction capture. */
function CorrectionContent() {
  const raw = useSearchParams().get("corrects") ?? "";
  const correctsId = /^\d{1,18}$/.test(raw) && Number(raw) > 0 ? Number(raw) : null;
  if (correctsId === null) {
    return (
      <PageFill>
        <CicPageHeader title="Prepare Correction" description="Choose the file to correct first." />
        <p className="text-sm">
          <Link href="/cic/corrections" className="underline">
            Open Corrections
          </Link>{" "}
          and pick the file CIC received.
        </p>
      </PageFill>
    );
  }
  return <GenerateWizard key={correctsId} correctsId={correctsId} />;
}

export default function CicPrepareCorrectionPage() {
  return (
    <CicGuard permission="cic:prepare" pageName="Prepare Correction">
      <Suspense fallback={<PageLoader />}>
        <CorrectionContent />
      </Suspense>
    </CicGuard>
  );
}
