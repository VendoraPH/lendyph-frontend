"use client";

import { useState } from "react";
import { RouteGuard } from "@/components/common/route-guard";
import { usePermission } from "@/hooks";
import { InstructionsCard } from "./_components/instructions-card";
import { PastRunsCard } from "./_components/past-runs-card";
import { RunPanel } from "./_components/run-panel";

function AutoCreditContent() {
  const canRun = usePermission().can("savings:post");
  // A processed run changes each instruction's last credited cycle and adds a past run.
  const [listKey, setListKey] = useState(0);
  return (
    <div className="min-w-0 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Savings Auto-Credit</h1>
        <p className="text-sm text-muted-foreground">
          Members&apos; standing instructions to credit their savings on the 15th and the 30th, and the run that posts
          them. The server plans every run and works out every figure.
        </p>
      </div>
      {canRun && <RunPanel onProcessed={() => setListKey((k) => k + 1)} />}
      <InstructionsCard key={listKey} />
      <PastRunsCard key={`runs-${listKey}`} />
    </div>
  );
}

export default function SavingsAutoCreditPage() {
  return (
    <RouteGuard permission="savings:view" pageName="Savings Auto-Credit">
      <AutoCreditContent />
    </RouteGuard>
  );
}
