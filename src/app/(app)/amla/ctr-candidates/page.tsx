"use client";

import { RouteGuard } from "@/components/common/route-guard";
import { AMLA_CTR_PERMISSION } from "@/lib/amla/monitoring-access";
import { CtrList } from "../_components/ctr-list";

export default function AmlaCtrCandidatesPage() {
  return (
    <RouteGuard permission={AMLA_CTR_PERMISSION} pageName="CTR Candidates">
      <CtrList />
    </RouteGuard>
  );
}
