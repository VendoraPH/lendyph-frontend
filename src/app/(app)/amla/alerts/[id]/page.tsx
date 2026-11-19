"use client";

import { notFound, useParams } from "next/navigation";
import { RouteGuard } from "@/components/common/route-guard";
import { AMLA_ALERTS_PERMISSION } from "@/lib/amla/monitoring-access";
import { amlaRecordId } from "@/lib/amla/record-id";
import { AlertDetail } from "../../_components/alert-detail";

/** One alert. An alert outside the caller's branches answers not found, as a missing one does. */
export default function AmlaAlertPage() {
  const id = amlaRecordId(useParams().id);
  if (id === null) notFound();
  return (
    <RouteGuard permission={AMLA_ALERTS_PERMISSION} pageName="Alert">
      <AlertDetail key={id} id={id} />
    </RouteGuard>
  );
}
