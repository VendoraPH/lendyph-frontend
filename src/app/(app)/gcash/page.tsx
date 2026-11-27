"use client";

import { Suspense, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { RouteGuard } from "@/components/common";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { MembersTab } from "./_components/members-tab";
import { TransactionsTab } from "./_components/transactions-tab";
import { ReportsTab } from "./_components/reports-tab";
import { PageFill } from "@/components/common/page-fill";
import { FIT_CLASSES } from "@/lib/page-fill";
import { cn } from "@/lib/utils";

type TabKey = "members" | "transactions" | "reports";
const TABS: TabKey[] = ["members", "transactions", "reports"];

function GCashPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const raw = searchParams.get("tab");
  const active: TabKey = TABS.includes(raw as TabKey)
    ? (raw as TabKey)
    : "members";

  const setTab = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", value);
      router.replace(`/gcash?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  return (
    <PageFill>
      <div className="shrink-0">
        <h1 className="text-2xl font-semibold">GCash</h1>
        <p className="text-sm text-muted-foreground">
          Record Cash In / Cash Out transactions for members and walk-ins,
          manage pending payments, and view income reports.
        </p>
      </div>

      <Tabs value={active} onValueChange={setTab} className={FIT_CLASSES.section}>
        <TabsList className="shrink-0">
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>
        <TabsContent value="members" className={cn("mt-4", FIT_CLASSES.section)}>
          <MembersTab />
        </TabsContent>
        <TabsContent value="transactions" className={cn("mt-4", FIT_CLASSES.section)}>
          <TransactionsTab />
        </TabsContent>
        <TabsContent value="reports" className={cn("mt-4", FIT_CLASSES.section)}>
          <ReportsTab />
        </TabsContent>
      </Tabs>
    </PageFill>
  );
}

export default function GCashPage() {
  return (
    <RouteGuard permission="gcash:view" pageName="GCash">
      <Suspense fallback={<div className="p-6">Loading…</div>}>
        <GCashPageContent />
      </Suspense>
    </RouteGuard>
  );
}
