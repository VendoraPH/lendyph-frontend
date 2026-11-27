"use client";

import { RouteGuard } from "@/components/common/route-guard";
import { RecordsScreen } from "../_components/records-screen";

export default function CicContractsPage() {
  return (
    <RouteGuard permission="cic:view" pageName="Contract Records">
      <RecordsScreen kind="contracts" />
    </RouteGuard>
  );
}
