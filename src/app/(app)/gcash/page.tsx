"use client";

import { Suspense, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { RouteGuard } from "@/components/common";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { MembersTab } from "./_components/members-tab";
import { TransactionsTab } from "./_components/transactions-tab";
import { ReportsTab } from "./_components/reports-tab";

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
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">GCash</h1>
        <p className="text-sm text-muted-foreground">
          Record Cash In / Cash Out transactions, manage pending payments, and
          view income reports.
        </p>
      </div>

      <Tabs value={active} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>
        <TabsContent value="members" className="mt-4">
          <MembersTab />
        </TabsContent>
        <TabsContent value="transactions" className="mt-4">
          <TransactionsTab />
        </TabsContent>
        <TabsContent value="reports" className="mt-4">
          <ReportsTab />
        </TabsContent>
      </Tabs>
    </div>
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
