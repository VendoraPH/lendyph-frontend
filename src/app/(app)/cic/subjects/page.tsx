"use client";

import { RouteGuard } from "@/components/common/route-guard";
import { RecordsScreen } from "../_components/records-screen";

export default function CicSubjectsPage() {
  return (
    <RouteGuard permission="cic:view" pageName="Subject Records">
      <RecordsScreen kind="subjects" />
    </RouteGuard>
  );
}
