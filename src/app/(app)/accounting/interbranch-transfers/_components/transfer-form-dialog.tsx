"use client";

import { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useBranches, useDialogOpening } from "@/hooks";
import { useApiResource } from "@/hooks/use-api-resource";
import { pickableBranches } from "@/lib/branch-choice";
import { notifySuccess, notifyWarning } from "@/lib/notify";
import { userBranches } from "@/lib/user-branches";
import { accountingService, interbranchTransferService } from "@/services";
import { useAuthStore } from "@/store";
import { AccountSelect } from "../../_components/account-select";
import { CASH_ACCOUNTS_PER_PAGE } from "../../cash-bank/_lib/cash-bank";
import {
  EMPTY_TRANSFER_FORM,
  PURPOSE_MAX,
  REFERENCE_MAX,
  buildTransferInput,
  transferFailure,
  type TransferForm,
  type TransferFormErrors,
} from "../_lib/transfers";
import { BranchPicker } from "./branch-picker";

interface TransferFormDialogProps {
  open: boolean;
  /** A Send back pre-fill, or null for a blank form. */
  initial: TransferForm | null;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

/**
 * Request a transfer from one branch's money account to another's. Nothing
 * posts until someone other than the maker approves it. The source is one of
 * the maker's branches (any with See all branches); the server checks again.
 */
export function TransferFormDialog({ open, initial, onOpenChange, onCreated }: TransferFormDialogProps) {
  const caller = useAuthStore((s) => s.user);
  const viewAll = useAuthStore((s) => s.hasPermission("branches:view_all"));
  const canListAccounts = useAuthStore((s) => s.hasPermission("cash_accounts:view"));
  const { branches, loading: branchesLoading } = useBranches(open);
  const accountsFetcher = useCallback(
    () => accountingService.cashAccountsPage({ per_page: CASH_ACCOUNTS_PER_PAGE }),
    [],
  );
  const accounts = useApiResource(accountsFetcher, open && canListAccounts);
  const moneyAccounts = accounts.data?.data ?? [];

  const sources = useMemo(
    () => pickableBranches({ viewAll, own: userBranches(caller), listed: branches }),
    [viewAll, caller, branches],
  );

  const [form, setForm] = useState<TransferForm>(EMPTY_TRANSFER_FORM);
  const [errors, setErrors] = useState<TransferFormErrors>({});
  const [general, setGeneral] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (useDialogOpening(open, initial)) {
    setForm(initial ?? EMPTY_TRANSFER_FORM);
    setErrors({});
    setGeneral(null);
  }

  const destinations = branches.filter((b) => b.id !== form.sourceBranchId);
  const set = <K extends keyof TransferForm>(key: K, value: TransferForm[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  async function submit() {
    const built = buildTransferInput(form);
    if (!built.ok) {
      setErrors(built.errors);
      return;
    }
    setBusy(true);
    setGeneral(null);
    try {
      const { transfer, warnings } = await interbranchTransferService.create(built.input);
      notifySuccess(`${transfer.transfer_number} is waiting for approval.`);
      for (const warning of warnings) notifyWarning(warning);
      onOpenChange(false);
      onCreated();
    } catch (err) {
      const failure = transferFailure(err);
      setErrors(failure.fields);
      setGeneral(failure.general);
    } finally {
      setBusy(false);
    }
  }

  const fieldError = (key: keyof TransferForm) =>
    errors[key] ? (
      <p className="text-xs text-destructive" role="alert">
        {errors[key]}
      </p>
    ) : null;

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{initial ? "Send money back" : "New interbranch transfer"}</DialogTitle>
          <DialogDescription>
            Nothing posts until someone other than you approves it. The money is then held in Interbranch Clearing
            until the other branch receives it.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <BranchPicker
              id="ibt-source"
              label="From branch"
              branches={sources}
              value={form.sourceBranchId}
              loading={branchesLoading}
              disabled={busy}
              onChange={(id) => set("sourceBranchId", id)}
            />
            {fieldError("sourceBranchId")}
          </div>
          <div className="space-y-1.5">
            <BranchPicker
              id="ibt-destination"
              label="To branch"
              branches={destinations}
              value={form.destinationBranchId}
              loading={branchesLoading}
              disabled={busy}
              onChange={(id) => set("destinationBranchId", id)}
            />
            {fieldError("destinationBranchId")}
          </div>

          {canListAccounts ? (
            <>
              <div className="space-y-1.5">
                <AccountSelect
                  label="From account"
                  accounts={moneyAccounts}
                  value={form.fromAccountId}
                  onChange={(id) => set("fromAccountId", id)}
                  className="w-full"
                />
                {fieldError("fromAccountId")}
              </div>
              <div className="space-y-1.5">
                <AccountSelect
                  label="To account"
                  accounts={moneyAccounts}
                  value={form.toAccountId}
                  onChange={(id) => set("toAccountId", id)}
                  className="w-full"
                />
                {fieldError("toAccountId")}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground sm:col-span-2" role="status">
              Picking the money accounts needs access to Cash &amp; Bank. Ask an administrator.
            </p>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="ibt-amount">Amount (₱)</Label>
            <Input
              id="ibt-amount"
              value={form.amount}
              onChange={(e) => set("amount", e.target.value)}
              placeholder="0.00"
              inputMode="decimal"
              className="text-right font-mono"
              disabled={busy}
              aria-invalid={errors.amount ? true : undefined}
            />
            {fieldError("amount")}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ibt-reference">Reference (optional)</Label>
            <Input
              id="ibt-reference"
              value={form.reference}
              onChange={(e) => set("reference", e.target.value)}
              maxLength={REFERENCE_MAX}
              placeholder="Deposit slip or courier number"
              disabled={busy}
            />
            {fieldError("reference")}
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="ibt-purpose">Purpose</Label>
            <Textarea
              id="ibt-purpose"
              value={form.purpose}
              onChange={(e) => set("purpose", e.target.value)}
              maxLength={PURPOSE_MAX}
              rows={2}
              placeholder="Cash for the North branch's releases"
              disabled={busy}
              aria-invalid={errors.purpose ? true : undefined}
            />
            {fieldError("purpose")}
          </div>
        </div>

        {general ? (
          <p className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive" role="alert">
            {general}
          </p>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy || !canListAccounts}>
            {busy ? "Saving…" : "Request transfer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
