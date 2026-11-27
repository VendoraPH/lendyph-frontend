"use client";

import { RouteGuard } from "@/components/common/route-guard";
import { TimeDepositsScreen } from "./_components/time-deposits-screen";

export default function TimeDepositsPage() {
  return (
    <RouteGuard permission="savings:view" pageName="Time Deposits">
      <TimeDepositsScreen />
    </RouteGuard>
  );
}
