"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { RouteGuard } from "@/components/common/route-guard";
import { PageLoader } from "@/components/common/page-fill";
import { todayISO } from "@/lib/format";
import { defaultCicReferenceDate } from "@/lib/cic/records";
import { GenerateWizard } from "./_components/generate-wizard";

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
    <RouteGuard permission="cic:prepare" pageName="Generate CIC Report">
      <Suspense fallback={<PageLoader />}>
        <GenerateContent />
      </Suspense>
    </RouteGuard>
  );
}
