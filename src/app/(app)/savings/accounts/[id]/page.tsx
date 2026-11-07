"use client";

import { useParams } from "next/navigation";
import { RouteGuard } from "@/components/common/route-guard";
import { AccountDetail } from "./_components/account-detail";

export default function SavingsAccountPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <RouteGuard permission="savings:view" pageName="Savings Account">
      <AccountDetail accountId={Number(id)} />
    </RouteGuard>
  );
}
