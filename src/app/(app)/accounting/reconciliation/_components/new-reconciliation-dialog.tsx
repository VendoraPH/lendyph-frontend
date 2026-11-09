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
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useDialogOpening, usePermission } from "@/hooks";
import type { Account } from "@/types";
import { AccountSelect } from "../../_components/account-select";
import { reconciliationCreate } from "../_lib/reconciliation-api";
import {
  BLANK_LINE,
  PERIOD_MAX,
  buildCreateBody,
  createErrorMessages,
  isBlankLine,
  parsePastedLines,
  type StatementForm,
} from "../_lib/statement-form";
import type { ReconciliationDetail } from "../_lib/types";
import { StatementLinesEditor } from "./statement-lines-editor";

const EMPTY_FORM: StatementForm = {
  accountId: null,
  period: "",
  startDate: "",
  endDate: "",
  statementBalance: "",
  lines: [{ ...BLANK_LINE }],
};

const PASTE_HINT =
  "One row per line: date (YYYY-MM-DD), description, amount and reference, separated by tabs (as copied from a spreadsheet) or commas.";

interface NewReconciliationDialogProps {
  open: boolean;
  /** Money accounts only: the ones carrying a cash kind. */
  accounts: Account[];
  onOpenChange: (open: boolean) => void;
  onCreated: (reconciliation: ReconciliationDetail) => void;
}

export function NewReconciliationDialog({ open, accounts, onOpenChange, onCreated }: NewReconciliationDialogProps) {
  const canViewAll = usePermission().can("branches:view_all");
  const [form, setForm] = useState<StatementForm>(EMPTY_FORM);
  const [paste, setPaste] = useState("");
  const [pasteErrors, setPasteErrors] = useState<string[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  if (useDialogOpening(open, EMPTY_FORM)) {
    setForm(EMPTY_FORM);
    setPaste("");
    setPasteErrors([]);
    setErrors([]);
  }

  const set = <K extends keyof StatementForm>(key: K, value: StatementForm[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const addPasted = () => {
    const parsed = parsePastedLines(paste);
    setPasteErrors(parsed.errors);
    if (parsed.lines.length > 0) {
      setForm((current) => ({ ...current, lines: [...current.lines.filter((l) => !isBlankLine(l)), ...parsed.lines] }));
    }
    if (parsed.errors.length === 0) setPaste("");
  };

  const submit = () => {
    if (submitting) return;
    const result = buildCreateBody(form);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setSubmitting(true);
    setErrors([]);
    reconciliationCreate(result.body)
      .then(onCreated)
      .catch((err: unknown) => setErrors(createErrorMessages(err, { canViewAll })))
      .finally(() => setSubmitting(false));
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !submitting && onOpenChange(next)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>New reconciliation</DialogTitle>
          <DialogDescription>
            Record what the statement says. Nothing is posted: the lines are matched against the books.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <AccountSelect
            label="Money account"
            accounts={accounts}
            value={form.accountId}
            onChange={(id) => set("accountId", id)}
            placeholder="Select a money account"
            className="w-full"
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="reconcile-period">Period (optional)</Label>
              <Input
                id="reconcile-period"
                value={form.period}
                maxLength={PERIOD_MAX}
                placeholder="Named from the dates, for example October 2026"
                onChange={(e) => set("period", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reconcile-balance">Statement closing balance (₱)</Label>
              <Input
                id="reconcile-balance"
                value={form.statementBalance}
                placeholder="0.00"
                className="text-right font-mono"
                onChange={(e) => set("statementBalance", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reconcile-start">Start date</Label>
              <Input id="reconcile-start" type="date" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reconcile-end">End date</Label>
              <Input id="reconcile-end" type="date" value={form.endDate} onChange={(e) => set("endDate", e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Statement lines (₱: money in positive, money out negative)</p>
            <StatementLinesEditor lines={form.lines} disabled={submitting} onChange={(lines) => set("lines", lines)} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="reconcile-paste">Paste rows</Label>
            <Textarea
              id="reconcile-paste"
              value={paste}
              rows={3}
              placeholder={PASTE_HINT}
              onChange={(e) => setPaste(e.target.value)}
            />
            <Button variant="outline" size="sm" disabled={!paste.trim() || submitting} onClick={addPasted}>
              Add pasted rows
            </Button>
            <ErrorList errors={pasteErrors} />
          </div>

          <ErrorList errors={errors} />
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting && <Spinner className="mr-2 h-4 w-4" />}
            {submitting ? "Starting…" : "Start reconciliation"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ErrorList({ errors }: { errors: string[] }) {
  if (errors.length === 0) return null;
  return (
    <ul role="alert" className="list-disc space-y-1 pl-5 text-sm text-destructive">
      {errors.map((error, i) => (
        <li key={i}>{error}</li>
      ))}
    </ul>
  );
}
