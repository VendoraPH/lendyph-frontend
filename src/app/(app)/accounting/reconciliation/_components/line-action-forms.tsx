"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { formatDate } from "@/lib/format";
import type { Account } from "@/types";
import { AccountSelect } from "../../_components/account-select";
import {
  EXPENSE_DESCRIPTION_MAX,
  EXPENSE_PAYEE_MAX,
  SUSPENSE_DESCRIPTION_MAX,
  TRANSFER_DESCRIPTION_MAX,
  expenseRequest,
  suspenseRequest,
  transferRequest,
} from "../_lib/line-actions";
import type { LineRecordRequest } from "../_lib/reconciliation-api";
import { descriptionDefault, suspenseConfirmation, transferDirection } from "../_lib/reconciliation-view";
import type { ReconciliationRow } from "../_lib/types";

interface FormProps {
  row: ReconciliationRow;
  reconciledAccountId: number;
  /** "1020 Cash in Bank": the account being reconciled. */
  reconciledAccount: string;
  submitting: boolean;
  /** The server's refusal, in its own words. */
  error: string | null;
  onBack: () => void;
  onSubmit: (request: LineRecordRequest) => void;
}

function TextField({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

function FormFooter({
  hint,
  error,
  submitting,
  submitLabel,
  onBack,
  onSubmit,
}: {
  hint: string | null;
  error: string | null;
  submitting: boolean;
  submitLabel: string;
  onBack: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="space-y-3">
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {!error && hint && <p className="text-sm text-muted-foreground">{hint}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onBack} disabled={submitting}>
          Back
        </Button>
        <Button onClick={onSubmit} disabled={submitting || hint !== null}>
          {submitting && <Spinner className="mr-2 h-4 w-4" />}
          {submitting ? "Recording…" : submitLabel}
        </Button>
      </div>
    </div>
  );
}

export function ExpenseForm({ accounts, ...props }: FormProps & { accounts: Account[] }) {
  const [accountId, setAccountId] = useState<number | null>(null);
  const [payee, setPayee] = useState("");
  const [description, setDescription] = useState("");
  const request = expenseRequest({ expenseAccountId: accountId, payee, description });

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {`Records a paid expense from ${props.reconciledAccount}, dated ${formatDate(props.row.date)}, and matches this line to it.`}
      </p>
      <AccountSelect
        label="Expense account"
        accounts={accounts}
        value={accountId}
        onChange={setAccountId}
        placeholder={accounts.length === 0 ? "No expense account is set up" : "Select an expense account"}
        className="w-full"
      />
      <TextField id="reconcile-expense-payee" label="Payee">
        <Input
          id="reconcile-expense-payee"
          value={payee}
          maxLength={EXPENSE_PAYEE_MAX}
          onChange={(e) => setPayee(e.target.value)}
        />
      </TextField>
      <TextField id="reconcile-expense-description" label="Description (optional)">
        <Input
          id="reconcile-expense-description"
          value={description}
          maxLength={EXPENSE_DESCRIPTION_MAX}
          placeholder={descriptionDefault("expense", props.row)}
          onChange={(e) => setDescription(e.target.value)}
        />
      </TextField>
      <FormFooter
        hint={request.ok ? null : request.reason}
        error={props.error}
        submitting={props.submitting}
        submitLabel="Record expense"
        onBack={props.onBack}
        onSubmit={() => request.ok && props.onSubmit({ kind: "expense", body: request.body })}
      />
    </div>
  );
}

export function TransferForm({ accounts, ...props }: FormProps & { accounts: Account[] }) {
  const [accountId, setAccountId] = useState<number | null>(null);
  const [description, setDescription] = useState("");
  const request = transferRequest({ counterAccountId: accountId, description }, props.reconciledAccountId);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {transferDirection(props.row, props.reconciledAccount)}
      </p>
      <AccountSelect
        label="Other money account"
        accounts={accounts}
        value={accountId}
        onChange={setAccountId}
        placeholder={accounts.length === 0 ? "No other money account is set up" : "Select a money account"}
        className="w-full"
      />
      <TextField id="reconcile-transfer-description" label="Description (optional)">
        <Input
          id="reconcile-transfer-description"
          value={description}
          maxLength={TRANSFER_DESCRIPTION_MAX}
          placeholder={descriptionDefault("transfer", props.row)}
          onChange={(e) => setDescription(e.target.value)}
        />
      </TextField>
      <FormFooter
        hint={request.ok ? null : request.reason}
        error={props.error}
        submitting={props.submitting}
        submitLabel="Record transfer"
        onBack={props.onBack}
        onSubmit={() => request.ok && props.onSubmit({ kind: "transfer", body: request.body })}
      />
    </div>
  );
}

export function SuspenseForm(props: FormProps) {
  const [description, setDescription] = useState("");
  const request = suspenseRequest({ description });
  const { entry, warning } = suspenseConfirmation(props.row, props.reconciledAccount);

  return (
    <div className="space-y-4">
      <div className="space-y-2 rounded-lg border bg-muted/40 p-3 text-sm">
        <p className="font-medium">{entry}</p>
        <p className="text-muted-foreground">{warning}</p>
      </div>
      <TextField id="reconcile-suspense-note" label="Note (optional)">
        <Input
          id="reconcile-suspense-note"
          value={description}
          maxLength={SUSPENSE_DESCRIPTION_MAX}
          onChange={(e) => setDescription(e.target.value)}
        />
      </TextField>
      <FormFooter
        hint={request.ok ? null : request.reason}
        error={props.error}
        submitting={props.submitting}
        submitLabel="Move to suspense"
        onBack={props.onBack}
        onSubmit={() => request.ok && props.onSubmit({ kind: "suspense", body: request.body })}
      />
    </div>
  );
}
