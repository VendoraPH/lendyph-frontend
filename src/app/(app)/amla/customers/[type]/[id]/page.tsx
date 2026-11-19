"use client";

import { notFound, useParams } from "next/navigation";
import { RouteGuard } from "@/components/common/route-guard";
import { AMLA_CUSTOMERS_PERMISSION, amlaSubjectFromRoute } from "@/lib/amla/cdd-access";
import { CustomerProfileScreen } from "../../_components/customer-profile-screen";

/** One member's or walk-in's CDD profile. Another branch's member, or a walk-in without head-office access, answers not found. */
export default function AmlaCustomerPage() {
  const params = useParams();
  const subject = amlaSubjectFromRoute(params.type, params.id);
  if (subject === null) notFound();
  return (
    <RouteGuard permission={AMLA_CUSTOMERS_PERMISSION} pageName="Customer due diligence">
      <CustomerProfileScreen key={`${subject.segment}-${subject.id}`} subject={subject} />
    </RouteGuard>
  );
}
