"use client";

import { notFound, useParams } from "next/navigation";
import { RouteGuard } from "@/components/common/route-guard";
import { amlaRecordId } from "@/lib/amla/monitoring-access";
import { CaseDetail } from "../../_components/case-detail";

/** One compliance case: `amla:cases` with every branch. */
export default function AmlaCasePage() {
  const id = amlaRecordId(useParams().id);
  if (id === null) notFound();
  return (
    <RouteGuard permission="amla:cases" pageName="Compliance case">
      <RouteGuard permission="branches:view_all" pageName="Compliance case">
        <CaseDetail key={id} id={id} />
      </RouteGuard>
    </RouteGuard>
  );
}
