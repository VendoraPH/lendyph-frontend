"use client";

import { notFound, useParams } from "next/navigation";
import { RouteGuard } from "@/components/common/route-guard";
import { amlaRecordId } from "@/lib/amla/record-id";
import { AMLA_SANCTIONS_PERMISSION } from "@/lib/amla/screening-access";
import { OrderDetail } from "../_components/order-detail";

export default function AmlaOrderPage() {
  const id = amlaRecordId(useParams().id);
  if (id === null) notFound();
  return (
    <RouteGuard permission={AMLA_SANCTIONS_PERMISSION} pageName="Order">
      <RouteGuard permission="branches:view_all" pageName="Order">
        <OrderDetail key={id} id={id} />
      </RouteGuard>
    </RouteGuard>
  );
}
