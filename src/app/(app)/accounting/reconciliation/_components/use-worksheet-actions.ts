"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ACCEPT_SUGGESTIONS_BODY, matchBody } from "../_lib/line-actions";
import { reconciliationMatch, recordLine, type LineRecordRequest } from "../_lib/reconciliation-api";
import {
  afterAction,
  matchFailure,
  requestFailure,
  type RequestFailure,
  type WorksheetState,
} from "../_lib/reconciliation-view";
import type { MatchReconciliationBody, ReconciliationRow } from "../_lib/types";

interface Worksheet {
  replace: (state: WorksheetState) => void;
  reload: () => void;
}

/**
 * The worksheet's writes. Each success re-renders from the answer's `data`
 * (no second GET). A 409, or a 422 on a match, shows the server's words and
 * reads the worksheet again; any other refusal goes back to the caller to show
 * in place.
 */
export function useWorksheetActions(id: number, worksheet: Worksheet, canViewAll: boolean) {
  const [busy, setBusy] = useState(false);
  const [resolving, setResolving] = useState<ReconciliationRow | null>(null);

  const settleRefusal = (failure: RequestFailure): RequestFailure => {
    if (failure.reload) {
      setResolving(null);
      toast.error(failure.message);
      worksheet.reload();
    }
    return failure;
  };

  const refused = (err: unknown): RequestFailure => settleRefusal(requestFailure(err, { canViewAll }));
  const matchRefused = (err: unknown): RequestFailure => settleRefusal(matchFailure(err, { canViewAll }));

  const match = (body: MatchReconciliationBody): Promise<RequestFailure | null> =>
    reconciliationMatch(id, body).then((reconciliation) => {
      worksheet.replace({ reconciliation, notice: null });
      return null;
    }, matchRefused);

  /** From the table: confirm a suggestion, undo a match, or accept every suggestion. */
  const runMatch = (body: MatchReconciliationBody) => {
    if (busy) return;
    setBusy(true);
    match(body)
      .then((failure) => {
        if (failure && !failure.reload) toast.error(failure.message);
      })
      .finally(() => setBusy(false));
  };

  const pairRow = (row: ReconciliationRow, journalLineId: number | null) => {
    if (row.statement_line_id !== null) runMatch(matchBody(row.statement_line_id, journalLineId));
  };

  const onMatch = (row: ReconciliationRow, journalLineId: number): Promise<RequestFailure | null> => {
    if (row.statement_line_id === null) return Promise.resolve(null);
    return match(matchBody(row.statement_line_id, journalLineId)).then((failure) => {
      if (failure === null) setResolving(null);
      return failure;
    });
  };

  const onRecord = (row: ReconciliationRow, request: LineRecordRequest): Promise<RequestFailure | null> => {
    if (row.statement_line_id === null) return Promise.resolve(null);
    return recordLine(request.kind, id, row.statement_line_id, request.body).then((answer) => {
      const next = afterAction(answer);
      worksheet.replace(next);
      setResolving(null);
      if (next.notice) toast.success(next.notice.text);
      return null;
    }, refused);
  };

  return {
    busy,
    resolving,
    setResolving,
    acceptSuggestions: () => runMatch(ACCEPT_SUGGESTIONS_BODY),
    confirm: (row: ReconciliationRow) => pairRow(row, row.journal_line_id),
    unmatch: (row: ReconciliationRow) => pairRow(row, null),
    onMatch,
    onRecord,
    /** The books already hold the line: read the worksheet again, where it shows as a possible match. */
    matchInstead: () => {
      setResolving(null);
      worksheet.reload();
      toast.info("The worksheet was read again. Confirm the line's possible match there.");
    },
  };
}
