"use client";

import { PortalPageHeader } from "@/components/portal/page-header";
import { featureOn } from "@/lib/portal/nav";
import { usePortalSession } from "@/lib/portal/portal-session";
import { SavingsAccounts } from "./_components/savings-accounts";
import { TimeDepositsList } from "./_components/time-deposits-list";

/** Savings accounts and time deposits, each part shown while the cooperative has it on. */
export default function SavingsPage() {
  const features = usePortalSession((s) => s.features);
  return (
    <>
      <PortalPageHeader title="Savings" description="Balances as your cooperative's books show them." />
      <div className="space-y-6">
        {featureOn(features, "savings") && <SavingsAccounts />}
        {featureOn(features, "time_deposits") && <TimeDepositsList />}
      </div>
    </>
  );
}
