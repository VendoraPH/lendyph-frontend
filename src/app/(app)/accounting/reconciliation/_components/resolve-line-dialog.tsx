"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useDialogOpening, usePermission } from "@/hooks";
import { formatCentavos } from "@/lib/accounting/money";
import { formatDate } from "@/lib/format";
import type { Account } from "@/types";
import {
  counterAccountChoices,
  expenseAccountChoices,
  lineActions,
  matchCandidates,
} from "../_lib/line-actions";
import type { LineRecordRequest } from "../_lib/reconciliation-api";
import { accountLabel, directionLabel, type RequestFailure } from "../_lib/reconciliation-view";
import type { LineActionKind, ReconciliationDetail, ReconciliationRow } from "../_lib/types";
import { ExpenseForm, SuspenseForm, TransferForm } from "./line-action-forms";
import { HiddenActionHint, ReasonButton } from "./reason-button";

type Mode = "choose" | "match" | LineActionKind;

const NO_CANDIDATE_REASON = "No ledger line in this period is waiting for a match.";

interface ResolveLineDialogProps {
  /** The unmatched statement line; the dialog is open while it is set. */
  row: ReconciliationRow | null;
  reconciliation: ReconciliationDetail;
  accounts: Account[];
  chartAvailable: boolean;
  onClose: () => void;
  /** Resolves to null on success, or the refusal to show here. */
  onMatch: (row: ReconciliationRow, journalLineId: number) => Promise<RequestFailure | null>;
  onRecord: (row: ReconciliationRow, request: LineRecordRequest) => Promise<RequestFailure | null>;
}

export function ResolveLineDialog({
  row,
  reconciliation,
  accounts,
  chartAvailable,
  onClose,
  onMatch,
  onRecord,
}: ResolveLineDialogProps) {
  const { can } = usePermission();
  const open = row !== null;
  const [mode, setMode] = useState<Mode>("choose");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (useDialogOpening(open, row)) {
    setMode("choose");
    setError(null);
  }

  if (row === null) return null;

  const reconciledAccount = accountLabel(reconciliation);
  const candidates = matchCandidates(reconciliation.lines);
  const actions = lineActions(row, { can, chartAvailable });

  const settle = (request: Promise<RequestFailure | null>) => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    request
      .then((failure) => setError(failure?.message ?? null))
      .finally(() => setSubmitting(false));
  };

  const choose = (next: Mode) => {
    setError(null);
    setMode(next);
  };

  const formProps = {
    row,
    reconciledAccountId: reconciliation.account_id,
    reconciledAccount,
    submitting,
    error,
    onBack: () => choose("choose"),
    onSubmit: (request: LineRecordRequest) => settle(onRecord(row, request)),
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !submitting && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Resolve statement line</DialogTitle>
          <DialogDescription>
            {`${formatDate(row.date)} · ${row.description} · ${directionLabel(row.amount)} ${formatCentavos(row.amount)}`}
            {row.external_reference ? ` · Reference ${row.external_reference}` : ""}
          </DialogDescription>
        </DialogHeader>

        {mode === "choose" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Nothing in the books stands for this line yet. Match it to a ledger line, or record the entry
              that is missing.
            </p>
            <div className="flex flex-col items-start gap-2">
              <ReasonButton
                variant="outline"
                reason={candidates.length === 0 ? NO_CANDIDATE_REASON : null}
                onClick={() => choose("match")}
              >
                Match to a ledger line
              </ReasonButton>
              {actions.map((action) =>
                action.visible ? (
                  <ReasonButton
                    key={action.kind}
                    variant="outline"
                    reason={action.disabledReason}
                    onClick={() => choose(action.kind)}
                  >
                    {action.label}
                  </ReasonButton>
                ) : (
                  <HiddenActionHint key={action.kind} label={action.label} reason={action.hiddenReason ?? ""} />
                ),
              )}
            </div>
          </div>
        )}

        {mode === "match" && (
          <div className="space-y-3">
            <ul className="max-h-72 space-y-2 overflow-y-auto">
              {candidates.map((candidate) => (
                <li
                  key={candidate.journal_line_id}
                  className="flex items-center justify-between gap-3 rounded-lg border p-2 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate">{candidate.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {`${formatDate(candidate.date)} · ${candidate.journal_no ?? "Journal"}`}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {candidate.amount === row.amount && <Badge variant="outline">Same amount</Badge>}
                    <span className="font-mono">{formatCentavos(candidate.amount)}</span>
                    <Button
                      size="sm"
                      disabled={submitting}
                      onClick={() => settle(onMatch(row, candidate.journal_line_id))}
                    >
                      Match
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => choose("choose")} disabled={submitting}>
                Back
              </Button>
            </div>
          </div>
        )}

        {mode === "expense" && <ExpenseForm accounts={expenseAccountChoices(accounts)} {...formProps} />}
        {mode === "transfer" && (
          <TransferForm accounts={counterAccountChoices(accounts, reconciliation.account_id)} {...formProps} />
        )}
        {mode === "suspense" && <SuspenseForm {...formProps} />}
      </DialogContent>
    </Dialog>
  );
}
