"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { PageLoader } from "@/components/common/page-fill";
import { todayISO } from "@/lib/format";
import { defaultCicReferenceDate } from "@/lib/cic/rules";
import { GenerateWizard } from "./_components/generate-wizard";
import { CicGuard } from "../_components/cic-guard";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** `?date=YYYY-MM-DD` opens on that File Reference Date; `?corrects=ID` starts a correction file. */
function GenerateContent() {
  const params = useSearchParams();
  const date = params.get("date");
  const corrects = Number(params.get("corrects"));
  return (
    <GenerateWizard
      initial={{
        referenceDate: date && ISO_DATE.test(date) ? date : defaultCicReferenceDate(todayISO()),
        correctsId: Number.isInteger(corrects) && corrects > 0 ? corrects : null,
      }}
    />
  );
}

export default function CicGeneratePage() {
  return (
    <CicGuard permission="cic:prepare" pageName="Generate CIC Report">
      <Suspense fallback={<PageLoader />}>
        <GenerateContent />
      </Suspense>
    </CicGuard>
  );
}
