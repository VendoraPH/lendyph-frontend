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
  recordAnyway,
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
  /** The books already hold this line: read the worksheet again so its possible match shows. */
  onMatchInstead: () => void;
}

/** A refusal because the books already hold the line, with the request to resend. */
interface InBooks {
  message: string;
  request: LineRecordRequest;
}

export function ResolveLineDialog({
  row,
  reconciliation,
  accounts,
  chartAvailable,
  onClose,
  onMatch,
  onRecord,
  onMatchInstead,
}: ResolveLineDialogProps) {
  const { can } = usePermission();
  const open = row !== null;
  const [mode, setMode] = useState<Mode>("choose");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inBooks, setInBooks] = useState<InBooks | null>(null);

  if (useDialogOpening(open, row)) {
    setMode("choose");
    setError(null);
    setInBooks(null);
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

  const record = (request: LineRecordRequest) => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    setInBooks(null);
    onRecord(row, request)
      .then((failure) => {
        if (failure?.inBooks) setInBooks({ message: failure.message, request });
        else setError(failure?.message ?? null);
      })
      .finally(() => setSubmitting(false));
  };

  const choose = (next: Mode) => {
    setError(null);
    setInBooks(null);
    setMode(next);
  };

  const formProps = {
    row,
    reconciledAccountId: reconciliation.account_id,
    reconciledAccount,
    submitting,
    error,
    onBack: () => choose("choose"),
    onSubmit: record,
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

        {inBooks && (
          <div role="alert" className="space-y-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
            <p>{inBooks.message}</p>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" disabled={submitting} onClick={onMatchInstead}>
                Match it instead
              </Button>
              <Button disabled={submitting} onClick={() => record(recordAnyway(inBooks.request))}>
                {submitting ? "Recording…" : "Record anyway"}
              </Button>
            </div>
          </div>
        )}

        {/* Hidden, not unmounted, while the choice is open: the form keeps what was typed. */}
        <div hidden={inBooks !== null}>
          {mode === "expense" && <ExpenseForm accounts={expenseAccountChoices(accounts)} {...formProps} />}
          {mode === "transfer" && (
            <TransferForm accounts={counterAccountChoices(accounts, reconciliation.account_id)} {...formProps} />
          )}
          {mode === "suspense" && <SuspenseForm {...formProps} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}
