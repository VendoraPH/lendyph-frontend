"use client";

import { useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useApiResource } from "@/hooks";
import { RouteGuard } from "@/components/common";
import { DataState } from "@/components/common/data-state";
import { PageHeader } from "@/components/common/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { savingsAccountService } from "@/services/savings-account.service";
import { ACCOUNT_STATUS_LABEL, ACCOUNT_STATUS_TONE } from "../../_lib/account-status";
import { ToneBadge } from "../../_components/tone-badge";
import { AccountActions } from "./_components/account-actions";
import { AccountMoneyLinks } from "./_components/account-money-links";
import { AccountSummary } from "./_components/account-summary";
import { AccountTransactions } from "./_components/account-transactions";
import { AuditLog, StatusHistory } from "./_components/account-history";

function AccountDetailContent({ accountId }: { accountId: number }) {
  const fetcher = useCallback(() => savingsAccountService.get(accountId), [accountId]);
  const resource = useApiResource(fetcher);

  return (
    <div className="min-w-0 space-y-6">
      <Link href="/savings/accounts" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Savings accounts
      </Link>
      <DataState
        resource={resource}
        summary="This savings account: the member, balances, rate, transactions and history."
        endpoints={["GET /savings/accounts/{id}"]}
      >
        {(account) => (
          <div className="space-y-6">
            <PageHeader
              title={account.account_number}
              description={`${account.member.full_name} · ${account.product.name}`}
              actions={
                <>
                  <ToneBadge tone={ACCOUNT_STATUS_TONE[account.status]}>{ACCOUNT_STATUS_LABEL[account.status]}</ToneBadge>
                  <AccountMoneyLinks account={account} />
                  <AccountActions account={account} onChanged={resource.refetch} />
                </>
              }
            />
            <AccountSummary account={account} />
            <Tabs defaultValue="transactions">
              <TabsList>
                <TabsTrigger value="transactions">Transactions</TabsTrigger>
                <TabsTrigger value="status">Status history</TabsTrigger>
                <TabsTrigger value="audit">Audit trail</TabsTrigger>
              </TabsList>
              <TabsContent value="transactions" className="pt-4">
                <AccountTransactions accountId={account.id} onChanged={resource.refetch} />
              </TabsContent>
              <TabsContent value="status" className="pt-4">
                <StatusHistory accountId={account.id} />
              </TabsContent>
              <TabsContent value="audit" className="pt-4">
                <AuditLog accountId={account.id} />
              </TabsContent>
            </Tabs>
          </div>
        )}
      </DataState>
    </div>
  );
}

export default function SavingsAccountDetailPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <RouteGuard permission="savings:view" pageName="Savings Account">
      <AccountDetailContent key={id} accountId={Number(id)} />
    </RouteGuard>
  );
}
