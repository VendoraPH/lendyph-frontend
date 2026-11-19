"use client";

import { notFound, useParams } from "next/navigation";
import { RouteGuard } from "@/components/common/route-guard";
import { AMLA_CTR_PERMISSION, amlaRecordId } from "@/lib/amla/monitoring-access";
import { CtrDetail } from "../../_components/ctr-detail";

/** One CTR candidate. Outside the caller's branches it answers not found. */
export default function AmlaCtrCandidatePage() {
  const id = amlaRecordId(useParams().id);
  if (id === null) notFound();
  return (
    <RouteGuard permission={AMLA_CTR_PERMISSION} pageName="CTR candidate">
      <CtrDetail key={id} id={id} />
    </RouteGuard>
  );
}
