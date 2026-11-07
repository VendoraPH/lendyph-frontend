"use client";

import { useParams } from "next/navigation";
import { RouteGuard } from "@/components/common/route-guard";
import { TimeDepositDetail } from "./_components/time-deposit-detail";

export default function TimeDepositPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <RouteGuard permission="savings:view" pageName="Time Deposit">
      <TimeDepositDetail depositId={Number(id)} />
    </RouteGuard>
  );
}
