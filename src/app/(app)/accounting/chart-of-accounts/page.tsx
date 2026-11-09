"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { PermissionGate, RouteGuard } from "@/components/common";
import { IncompleteListNotice } from "@/components/common/incomplete-list-notice";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useChartOfAccounts, usePermission } from "@/hooks";
import { notifyError, notifySuccess } from "@/lib/notify";
import { accountingService } from "@/services";
import type { Account } from "@/types";
import { AccountingPageHeader } from "../_components/page-header";
import { AccountDialog, type AccountDialogState } from "./_components/account-dialog";
import { AccountStatusDialog } from "./_components/account-status-dialog";
import { ChartOfAccountsTable } from "./_components/chart-of-accounts-table";
import { SeedChartCard } from "./_components/seed-chart-card";
import type { AccountPayload, AccountWithCategory } from "./_lib/account-form";

function ChartOfAccountsContent() {
  // The module's existing hook rather than a fetch of its own: it drains every
  // page (the chart is 50-odd rows against a default page size of 15) and
  // already falls back to the template when there is nothing saved yet.
  const { accounts, loading, isTemplate, notBuiltYet, truncated, total, refetch } =
    useChartOfAccounts();
  const { can } = usePermission();
  const [dialog, setDialog] = useState<AccountDialogState>(null);
  const [statusTarget, setStatusTarget] = useState<Account | null>(null);

  // The template's ids are placeholders, so nothing in it can be edited.
  const canEdit = can("chart_of_accounts:update") && !isTemplate;

  const save = async (payload: AccountPayload, account: AccountWithCategory | null) => {
    try {
      if (account) {
        await accountingService.updateAccount(account.id, payload);
      } else {
        await accountingService.createAccount(payload);
      }
    } catch (err) {
      notifyError(err, "Could not save this account.");
      throw err;
    }
    notifySuccess(account ? "Account updated" : "Account added");
    setDialog(null);
    refetch();
  };

  const setActive = async (account: Account, isActive: boolean) => {
    try {
      await accountingService.updateAccount(account.id, { is_active: isActive });
    } catch (err) {
      notifyError(err, "Could not change this account's status.");
      throw err;
    }
    notifySuccess(isActive ? "Account reactivated" : "Account deactivated");
    setStatusTarget(null);
    refetch();
  };

  return (
    <div className="space-y-6">
      <AccountingPageHeader
        title="Chart of Accounts"
        description="The account tree every journal entry posts into."
        actions={
          <PermissionGate permission="chart_of_accounts:create">
            <Button onClick={() => setDialog({ mode: "create" })} disabled={loading || isTemplate}>
              <Plus className="mr-2 h-4 w-4" />
              Add account
            </Button>
          </PermissionGate>
        }
      />

      {loading ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <Spinner className="h-6 w-6" />
            <p className="text-sm text-muted-foreground">Loading…</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/*
            Offered only while the chart is still the template AND the list
            endpoint merely has nothing to give — never on the back of a
            failed request, which says nothing about whether a chart exists.
            Renders nothing without `chart_of_accounts:create`.
          */}
          {isTemplate && (
            <SeedChartCard notBuiltYet={notBuiltYet} onSeeded={refetch} />
          )}

          <Card>
            <CardContent className="space-y-4 pt-6">
              {isTemplate && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
                  <span className="font-medium">Default template.</span>{" "}
                  <span className="text-muted-foreground">
                    This is the chart a new organisation is seeded with. It is
                    not yet saved to your organisation, so it cannot be edited
                    and no entry can be posted against it.
                  </span>
                </div>
              )}

              {truncated && (
                <IncompleteListNotice
                  shown={accounts.length}
                  total={total}
                  noun="accounts"
                  consequence="An account missing from this table is also missing from every picker in the module."
                />
              )}

              <ChartOfAccountsTable
                accounts={accounts}
                onEdit={canEdit ? (account) => setDialog({ mode: "edit", account }) : undefined}
                onToggleActive={canEdit ? setStatusTarget : undefined}
              />
            </CardContent>
          </Card>
        </>
      )}

      <AccountDialog
        state={dialog}
        accounts={accounts}
        onClose={() => setDialog(null)}
        onSubmit={save}
      />
      <AccountStatusDialog
        account={statusTarget}
        onClose={() => setStatusTarget(null)}
        onConfirm={setActive}
      />
    </div>
  );
}

export default function ChartOfAccountsPage() {
  return (
    <RouteGuard permission="chart_of_accounts:view" pageName="Chart of Accounts">
      <ChartOfAccountsContent />
    </RouteGuard>
  );
}
