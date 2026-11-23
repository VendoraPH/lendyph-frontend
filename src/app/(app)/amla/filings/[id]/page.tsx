"use client";

import { notFound, useParams } from "next/navigation";
import { RouteGuard } from "@/components/common/route-guard";
import { AMLA_REPORT_READ } from "@/lib/amla/case-access";
import { amlaRecordId } from "@/lib/amla/record-id";
import { FilingDetail } from "../../_components/filing-detail";

/** One CTR or STR: any reporting key. Outside the caller's scope it answers not found. */
export default function AmlaFilingPage() {
  const id = amlaRecordId(useParams().id);
  if (id === null) notFound();
  return (
    <RouteGuard permission={[...AMLA_REPORT_READ]} pageName="AMLA report">
      <FilingDetail key={id} id={id} />
    </RouteGuard>
  );
}
