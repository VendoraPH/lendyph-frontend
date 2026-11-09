"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useDialogOpening } from "@/hooks";
import type { Account, AccountType } from "@/types";
import type { SelectItemOption } from "../../_lib/select-items";
import {
  DESCRIPTION_MAX,
  NO_PARENT,
  accountFormFromAccount,
  accountTypeItems,
  buildAccountPayload,
  cashFlowCategoryItems,
  cashKindItems,
  emptyAccountForm,
  parentHeadingItems,
  type AccountFormValues,
  type AccountPayload,
  type AccountWithCategory,
} from "../_lib/account-form";

/** Closed, adding a new account, or editing one. */
export type AccountDialogState =
  | null
  | { mode: "create" }
  | { mode: "edit"; account: AccountWithCategory };

interface AccountDialogProps {
  state: AccountDialogState;
  /** The whole chart, for the parent heading picker. */
  accounts: Account[];
  onClose: () => void;
  /** Must return the request's promise, and reject on failure so the form stays. */
  onSubmit: (payload: AccountPayload, account: AccountWithCategory | null) => Promise<void>;
}

/**
 * Add or edit an account. The server's rules (the code agrees with the type,
 * a parent is a heading of the same type, a mapped account keeps its type)
 * answer as 422 messages, which the caller shows as they are.
 */
export function AccountDialog({ state, accounts, onClose, onSubmit }: AccountDialogProps) {
  const open = state !== null;
  const editing = state?.mode === "edit" ? state.account : null;
  const [form, setForm] = useState<AccountFormValues>(emptyAccountForm);
  const [submitting, setSubmitting] = useState(false);

  if (useDialogOpening(open, state)) {
    setForm(editing ? accountFormFromAccount(editing) : emptyAccountForm());
  }

  const set = <K extends keyof AccountFormValues>(field: K, value: AccountFormValues[K]) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  // A stored category can be changed but not cleared, so "Automatic" is
  // offered only where leaving the field out lets the server set it.
  const categoryItems = cashFlowCategoryItems(!editing || !editing.cash_flow_category);
  const parentItems = parentHeadingItems(accounts, form.type, editing?.id ?? null);
  const payload = buildAccountPayload(form);

  const submit = async () => {
    if (!payload || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit(payload, editing);
    } catch {
      // The caller has already shown the server's message; the form stays.
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !submitting && !next && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? `Edit ${editing.code} ${editing.name}` : "Add an account"}</DialogTitle>
          <DialogDescription>
            The code&rsquo;s first digit follows the type: 1 asset, 2 liability,
            3 equity, 4 income, 5 expense.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="account-code">Code</Label>
              <Input
                id="account-code"
                value={form.code}
                onChange={(e) => set("code", e.target.value)}
                maxLength={16}
                inputMode="numeric"
                className="font-mono"
                placeholder="1035"
              />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="account-name">Name</Label>
              <Input
                id="account-name"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                maxLength={160}
                placeholder="Cash in Bank - BPI"
              />
            </div>
          </div>

          <FieldSelect
            id="account-type"
            label="Type"
            value={form.type || null}
            items={accountTypeItems}
            placeholder="Choose a type"
            onChange={(value) => {
              // A heading of another type can't hold this account.
              setForm((prev) => ({ ...prev, type: value as AccountType, parentId: NO_PARENT }));
            }}
          />

          <FieldSelect
            id="account-parent"
            label="Parent heading"
            value={form.parentId}
            items={parentItems}
            onChange={(value) => set("parentId", value)}
          />

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label htmlFor="account-contra" className="text-sm font-medium">
                Contra account
              </Label>
              <p className="text-xs text-muted-foreground">
                Reduces the accounts it sits with, such as an allowance for
                credit losses.
              </p>
            </div>
            <Switch
              id="account-contra"
              checked={form.isContra}
              onCheckedChange={(checked) => set("isContra", checked)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FieldSelect
              id="account-cash-kind"
              label="Money account"
              value={form.cashKind}
              items={cashKindItems}
              onChange={(value) => set("cashKind", value)}
            />
            <FieldSelect
              id="account-cash-flow"
              label="Cash flow category"
              value={form.cashFlowCategory}
              items={categoryItems}
              onChange={(value) => set("cashFlowCategory", value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="account-description">Description</Label>
            <Textarea
              id="account-description"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              maxLength={DESCRIPTION_MAX}
              rows={2}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!payload || submitting}>
            {submitting && <Spinner className="mr-2 h-4 w-4" />}
            {submitting ? "Saving…" : editing ? "Save changes" : "Add account"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface FieldSelectProps {
  id: string;
  label: string;
  value: string | null;
  items: readonly SelectItemOption[];
  placeholder?: string;
  onChange: (value: string) => void;
}

/** A labelled Select whose closed trigger reads its label from `items`. */
function FieldSelect({ id, label, value, items, placeholder, onChange }: FieldSelectProps) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={(v) => v != null && onChange(v)} items={items}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
