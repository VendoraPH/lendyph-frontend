"use client";

import { usePermission } from "@/hooks";
import { RouteGuard } from "@/components/common";
import { PageHeader } from "@/components/common/page-header";
import { BatchList } from "./_components/batch-list";
import { InterestRun } from "./_components/interest-run";

function InterestContent() {
  // Running interest needs `savings:post`; an approver only reviews the batches.
  const canRun = usePermission().can("savings:post");
  return (
    <div className="min-w-0 space-y-6">
      <PageHeader
        title="Savings interest"
        description="Preview the interest each account earned for a period, save it as a batch, then approve and post it."
      />
      {canRun && <InterestRun />}
      <BatchList />
    </div>
  );
}

export default function SavingsInterestPage() {
  return (
    <RouteGuard permission={["savings:post", "savings:approve"]} pageName="Savings Interest">
      <InterestContent />
    </RouteGuard>
  );
}
