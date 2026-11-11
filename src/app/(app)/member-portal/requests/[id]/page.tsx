"use client";

import { useParams } from "next/navigation";
import { RouteGuard } from "@/components/common/route-guard";
import { RequestDetail } from "../_components/request-detail";

export default function PortalRequestPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <RouteGuard permission="member_portal:requests" pageName="Portal Requests">
      <RequestDetail id={Number(id)} />
    </RouteGuard>
  );
}
