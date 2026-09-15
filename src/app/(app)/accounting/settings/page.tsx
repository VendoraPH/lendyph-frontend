"use client";

import { useCallback, useEffect, useState } from "react";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { PermissionGate, RouteGuard } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAccountingResource, useChartOfAccounts } from "@/hooks";
import { accountingService } from "@/services";
import type { AccountMapping, AccountType } from "@/types";
import { AccountingPageHeader } from "../_components/page-header";
import { DataState } from "../_components/data-state";
import { AccountSelect } from "../_components/account-select";

interface MappingField {
  key: keyof AccountMapping;
  label: string;
  hint: string;
  /** Which account types may fill this role. */
  types: AccountType[];
  /** True when only a money account makes sense. */
  moneyOnly?: boolean;
}

/**
 * Every role the posting engine resolves, grouped the way an operator thinks.
 *
 * These are settings rather than constants because organisations genuinely
 * differ — a cooperative books membership fees somewhere a lending corporation
 * does not — and because a wrong default that cannot be corrected would
 * silently misstate income for as long as nobody noticed.
 */
const GROUPS: { title: string; description: string; fields: MappingField[] }[] = [
  {
    title: "Where money is held",
    description: "Which account each settlement method debits or credits.",
    fields: [
      { key: "cash", label: "Cash", hint: "Collections taken in cash.", types: ["asset"], moneyOnly: true },
      { key: "bank", label: "Bank", hint: "Bank deposits and withdrawals.", types: ["asset"], moneyOnly: true },
      { key: "gcash", label: "GCash", hint: "GCash wallet balance.", types: ["asset"], moneyOnly: true },
      { key: "maya", label: "Maya", hint: "Maya wallet balance.", types: ["asset"], moneyOnly: true },
    ],
  },
  {
    title: "What borrowers owe",
    description: "The receivables a release and its charges create.",
    fields: [
      {
        key: "loans_receivable",
        label: "Loans receivable",
        hint: "Principal outstanding. Debited on release, credited on collection.",
        types: ["asset"],
      },
      {
        key: "interest_receivable",
        label: "Interest receivable",
        hint: "Interest earned but not yet collected.",
        types: ["asset"],
      },
      {
        key: "penalty_receivable",
        label: "Penalty receivable",
        hint: "Penalties charged but not yet collected.",
        types: ["asset"],
      },
    ],
  },
  {
    title: "What the business earns",
    description: "Where each kind of income is recognised.",
    fields: [
      { key: "interest_income", label: "Interest income", hint: "Interest on loans.", types: ["income"] },
      { key: "penalty_income", label: "Penalty income", hint: "Late-payment penalties.", types: ["income"] },
      {
        key: "processing_fee_income",
        label: "Processing fee income",
        hint: "Fees charged at release or collection.",
        types: ["income"],
      },
    ],
  },
  {
    title: "Credit losses and payables",
    description: "Provisioning and what the business owes others.",
    fields: [
      {
        key: "credit_loss_expense",
        label: "Credit loss expense",
        hint: "The cost side of a provision.",
        types: ["expense"],
      },
      {
        key: "allowance_credit_losses",
        label: "Allowance for credit losses",
        hint: "A contra-asset. It reduces net receivables without changing what a borrower owes.",
        types: ["asset"],
      },
      {
        key: "accounts_payable",
        label: "Accounts payable",
        hint: "Expenses recorded but not yet paid.",
        types: ["liability"],
      },
    ],
  },
];

export default function AccountingSettingsPage() {
  const { postable, isTemplate } = useChartOfAccounts();
  const [draft, setDraft] = useState<Partial<AccountMapping>>({});
  const [saving, setSaving] = useState(false);

  const fetcher = useCallback(() => accountingService.getAccountMapping(), []);
  const resource = useAccountingResource<AccountMapping>(fetcher);
  const { data } = resource;

  // Seed the form once the saved mapping arrives. Guarded on `data` rather
  // than run on every render so a half-typed change is not thrown away by an
  // unrelated re-render.
  useEffect(() => {
    if (data) setDraft(data);
  }, [data]);

  const save = async () => {
    setSaving(true);
    try {
      await accountingService.updateAccountMapping(draft);
      toast.success("Default accounts saved.");
      resource.refetch();
    } catch {
      toast.error("Could not save these settings.");
    } finally {
      setSaving(false);
    }
  };

  const accountsFor = (field: MappingField) =>
    postable.filter(
      (account) =>
        field.types.includes(account.type) &&
        (!field.moneyOnly || Boolean(account.cash_kind)),
    );

  return (
    <RouteGuard permission="accounting:settings" pageName="Accounting Settings">
      <div className="space-y-6">
        <AccountingPageHeader
          title="Accounting Settings"
          description="Which account each automatic entry posts to."
          actions={
            <PermissionGate permission="accounting:settings">
              <Button onClick={save} disabled={saving || isTemplate}>
                <Save className="mr-2 h-4 w-4" />
                {saving ? "Saving…" : "Save"}
              </Button>
            </PermissionGate>
          }
        />

        <div className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
          Set these once. Every entry Lendy writes for a release, a collection,
          a fee or a penalty resolves its accounts from here — change one and
          future entries follow it, while entries already posted keep the
          account they were posted to.
        </div>

        <DataState
          resource={resource}
          summary="The account each posting rule resolves to, so an automatic entry lands where your accountant expects it."
          endpoints={[
            "GET /accounting/settings/account-mapping",
            "PUT /accounting/settings/account-mapping",
          ]}
        >
          {() => (
            <div className="space-y-4">
              {GROUPS.map((group) => (
                <Card key={group.title}>
                  <CardContent className="space-y-4 pt-6">
                    <div>
                      <h2 className="text-sm font-semibold">{group.title}</h2>
                      <p className="text-sm text-muted-foreground">
                        {group.description}
                      </p>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      {group.fields.map((field) => (
                        <div key={field.key} className="space-y-1">
                          <AccountSelect
                            label={field.label}
                            accounts={accountsFor(field)}
                            value={draft[field.key] ?? null}
                            onChange={(id) =>
                              setDraft((current) => ({
                                ...current,
                                [field.key]: id ?? undefined,
                              }))
                            }
                            className="w-full"
                          />
                          <p className="text-xs text-muted-foreground">
                            {field.hint}
                          </p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </DataState>
      </div>
    </RouteGuard>
  );
}
