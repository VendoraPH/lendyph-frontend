"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useApiResource, usePermission, useSubmitGuard } from "@/hooks";
import { borrowerService } from "@/services";
import { RouteGuard } from "@/components/common";
import { DataState } from "@/components/common/data-state";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatDate, todayISO } from "@/lib/format";
import { notifySuccess, notifyValidation, notifyWarning } from "@/lib/notify";
import { savingsAccountService } from "@/services/savings-account.service";
import type { OpenSavingsAccountPayload, SavingsProduct } from "@/types/savings";
import { ConfirmActionDialog } from "../../_components/confirm-action-dialog";
import { paymentMethodLabel } from "../../_lib/payment-methods";
import { useSavingsProducts } from "../../_hooks/use-savings-products";
import { MemberCard } from "./_components/member-card";
import { OpenAccountFields } from "./_components/open-account-fields";
import { ProductTerms } from "./_components/product-terms";
import { emptyOpenAccountForm, openAccountPayload, type OpenAccountForm } from "./_lib/open-account-form";

const ENDPOINTS = ["GET /savings/products?status=active", "GET /savings/accounts/next-number", "POST /savings/accounts"];

function OpenAccountContent() {
  const router = useRouter();
  const guard = useSubmitGuard();
  const products = useSavingsProducts("active");
  const [today] = useState(todayISO);
  const canViewMembers = usePermission().can("borrowers:view");
  const [form, setForm] = useState<OpenAccountForm>(() => emptyOpenAccountForm(today));
  const [pending, setPending] = useState<OpenSavingsAccountPayload | null>(null);

  const set = <K extends keyof OpenAccountForm>(key: K, value: OpenAccountForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const rows = useMemo(() => products.data?.rows ?? [], [products.data]);
  const product: SavingsProduct | null = rows.find((p) => p.id === form.savings_product_id) ?? null;

  // The member's record (a borrowers read) only with `borrowers:view`.
  const borrowerId = form.borrower_id;
  const memberFetcher = useCallback(
    () => (borrowerId === null ? Promise.resolve(null) : borrowerService.detail(borrowerId)),
    [borrowerId],
  );
  const member = useApiResource(memberFetcher, canViewMembers && borrowerId !== null);
  const loaded = member.loading ? null : member.data;
  const branchId = loaded ? (loaded.branch_id ?? loaded.branch?.id ?? null) : null;

  // The number preview is per branch, so it waits for the member's branch.
  const nextNumberFetcher = useCallback(
    () => savingsAccountService.nextNumber({ branch_id: branchId }),
    [branchId],
  );
  const nextNumber = useApiResource(nextNumberFetcher, branchId !== null);

  const review = () => {
    const check = openAccountPayload(form, product, today);
    if (!check.ok) {
      if (check.message) notifyWarning(check.message);
      else notifyValidation(check.fields);
      return;
    }
    setPending(check.payload);
  };

  const submit = async () => {
    if (!pending) return;
    const result = await guard.run((key) => savingsAccountService.open(pending, key));
    if (!result) return;
    notifySuccess("Savings account opened", `Account ${result.account.account_number}`);
    router.push(`/savings/accounts/${result.account.id}`);
  };

  if (!products.allowed) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          Opening an account needs access to savings products (Savings: view). Ask an administrator to add it to your role.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="min-w-0 space-y-6">
      <PageHeader
        title="Open savings account"
        description="Choose the member and an active product. The product's minimums and rate fill in on their own."
      />
      <DataState
        resource={products}
        summary="Active savings products to open the account on."
        endpoints={ENDPOINTS}
        isEmpty={(d) => d.rows.length === 0}
        emptyMessage="There is no active savings product yet. Add or activate one under Savings → Products."
      >
        {() => (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
            <Card>
              <CardContent className="space-y-6 pt-6">
                <OpenAccountFields
                  form={form}
                  set={set}
                  products={rows}
                  productsLoading={products.loading}
                  today={today}
                  accountNumberPreview={nextNumber.data?.account_number ?? null}
                />
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => router.push("/savings/accounts")}>
                    Cancel
                  </Button>
                  <Button
                    onClick={review}
                    disabled={guard.submitting}
                    className="bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark"
                  >
                    Review and open
                  </Button>
                </div>
              </CardContent>
            </Card>
            <div className="space-y-4">
              {form.borrower_id !== null && canViewMembers && <MemberCard member={member} />}
              {product && <ProductTerms product={product} />}
            </div>
          </div>
        )}
      </DataState>

      <ConfirmActionDialog
        open={pending !== null}
        onOpenChange={(open) => !open && !guard.submitting && setPending(null)}
        title="Open this savings account?"
        description="The account is opened and the initial deposit posted together."
        confirmLabel="Open account"
        onConfirm={submit}
        errorFallback="The account could not be opened."
      >
        {pending && (
          <dl className="grid grid-cols-2 gap-2 rounded-md border p-3 text-sm">
            <dt className="text-muted-foreground">Product</dt>
            <dd className="font-medium">{product?.name}</dd>
            <dt className="text-muted-foreground">Date opened</dt>
            <dd>{formatDate(pending.opened_at)}</dd>
            <dt className="text-muted-foreground">Initial deposit</dt>
            <dd className="font-medium">{formatCurrency(pending.initial_deposit)}</dd>
            <dt className="text-muted-foreground">Payment method</dt>
            <dd>{paymentMethodLabel(pending.payment_method)}</dd>
          </dl>
        )}
      </ConfirmActionDialog>
    </div>
  );
}

export default function OpenSavingsAccountPage() {
  return (
    <RouteGuard permission="savings:create" pageName="Open Savings Account">
      <OpenAccountContent />
    </RouteGuard>
  );
}
