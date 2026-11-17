"use client";

import { PageFill, ScrollBox } from "@/components/common/page-fill";
import { PortalPageHeader } from "@/components/portal/page-header";
import { featureOn } from "@/lib/portal/nav";
import { usePortalSession } from "@/lib/portal/portal-session";
import { SavingsAccounts } from "./_components/savings-accounts";
import { TimeDepositsList } from "./_components/time-deposits-list";

/**
 * Savings accounts and time deposits, each part shown while the cooperative
 * has it on. At the `fit:` size the heading stays put and both parts scroll
 * together under it.
 */
export default function SavingsPage() {
  const features = usePortalSession((s) => s.features);
  return (
    <PageFill className="gap-5">
      <PortalPageHeader title="Savings" description="Balances as your cooperative's books show them." />
      <ScrollBox className="space-y-6 p-px">
        {featureOn(features, "savings") && <SavingsAccounts />}
        {featureOn(features, "time_deposits") && <TimeDepositsList />}
      </ScrollBox>
    </PageFill>
  );
}
