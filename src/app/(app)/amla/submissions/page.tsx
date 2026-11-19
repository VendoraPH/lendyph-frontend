"use client";

import { RouteGuard } from "@/components/common/route-guard";
import { AMLA_REPORT_READ } from "@/lib/amla/case-access";
import { SubmissionsRegister } from "../_components/submissions-register";

/** Any reporting key, as the reports list and the filing deadlines need. */
export default function AmlaSubmissionsPage() {
  return (
    <RouteGuard permission={[...AMLA_REPORT_READ]} pageName="Regulatory Submissions">
      <SubmissionsRegister />
    </RouteGuard>
  );
}
