"use client";

import { notFound, useParams } from "next/navigation";
import { RouteGuard } from "@/components/common/route-guard";
import { amlaRecordId } from "@/lib/amla/record-id";
import { AMLA_SCREENING_PERMISSION } from "@/lib/amla/screening-access";
import { MatchDetail } from "../_components/match-detail";

export default function AmlaMatchPage() {
  const id = amlaRecordId(useParams().id);
  if (id === null) notFound();
  return (
    <RouteGuard permission={AMLA_SCREENING_PERMISSION} pageName="Screening match">
      <RouteGuard permission="branches:view_all" pageName="Screening match">
        <MatchDetail key={id} id={id} />
      </RouteGuard>
    </RouteGuard>
  );
}
