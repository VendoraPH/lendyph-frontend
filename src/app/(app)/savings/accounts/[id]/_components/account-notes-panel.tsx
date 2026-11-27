"use client";

import { useCallback, useState } from "react";
import { DataState } from "@/components/common/data-state";
import { PermissionGate } from "@/components/common/permission-gate";
import { TablePagination } from "@/components/common/table-pagination";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useApiResource } from "@/hooks";
import { useSubmitGuard } from "@/hooks/use-submit-guard";
import { formatDateTime } from "@/lib/format";
import { notifyError, notifySuccess } from "@/lib/notify";
import { savingsService } from "@/services";
import { FormField } from "../../../_components/field";
import { actorName } from "../../../_lib/savings-rules";
import { NOTE_MAX_LENGTH, NOTE_PRIVACY_HINT, checkNote, noteLengthText } from "../_lib/account-notes";

/**
 * An account's notes timeline (gap round S4): newest first, paged on the
 * server. Anyone with savings:view reads it; savings:post adds a note. Notes
 * are never edited or deleted, and each one added is audited on the account.
 */
export function AccountNotesPanel({ accountId }: { accountId: number }) {
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [draft, setDraft] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const { submitting, run } = useSubmitGuard();

  const fetcher = useCallback(
    () => savingsService.notes(accountId, { page, per_page: perPage }),
    [accountId, page, perPage],
  );
  const resource = useApiResource(fetcher);

  const check = checkNote(draft);
  const error = submitted && !check.ok ? check.message : null;

  function add() {
    setSubmitted(true);
    if (!check.ok) return;
    run(() => savingsService.addNote(accountId, check.note))
      ?.then(() => {
        notifySuccess("Note added");
        setDraft("");
        setSubmitted(false);
        setPage(1);
        resource.refetch();
      })
      .catch((err: unknown) => notifyError(err, "Couldn't add the note."));
  }

  return (
    <div className="space-y-4">
      <PermissionGate permission="savings:post">
        <div className="space-y-2">
          <FormField
            id={`note-${accountId}`}
            label="Add a note"
            error={error}
            hint={`${NOTE_PRIVACY_HINT} ${noteLengthText(draft)}`}
          >
            <Textarea
              id={`note-${accountId}`}
              value={draft}
              maxLength={NOTE_MAX_LENGTH}
              rows={3}
              onChange={(e) => setDraft(e.target.value)}
              aria-invalid={error ? true : undefined}
            />
          </FormField>
          <div className="flex justify-end">
            <Button size="sm" onClick={add} disabled={submitting}>
              {submitting ? "Adding…" : "Add note"}
            </Button>
          </div>
        </div>
      </PermissionGate>

      <DataState
        resource={resource}
        endpoints={["GET /savings/accounts/{id}/notes"]}
        summary="Staff notes on this account will show here once the savings service is connected."
        isEmpty={(res) => res.data.length === 0}
        emptyMessage="No notes on this account yet."
      >
        {(res) => (
          <div className="space-y-3">
            <ol className="space-y-3" aria-label="Account notes, newest first">
              {res.data.map((n) => (
                <li key={n.id} className="rounded-md border-l-2 border-primary/40 bg-muted/30 px-3 py-2">
                  <p className="whitespace-pre-wrap break-words text-sm">{n.note}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {actorName(n.created_by)}
                    {n.created_at && ` · ${formatDateTime(n.created_at)}`}
                  </p>
                </li>
              ))}
            </ol>
            {res.meta.total > perPage && (
              <TablePagination
                page={page}
                perPage={perPage}
                total={res.meta.total}
                perPageOptions={[10, 25, 50]}
                onPageChange={setPage}
                onPerPageChange={(n) => {
                  setPerPage(n);
                  setPage(1);
                }}
              />
            )}
          </div>
        )}
      </DataState>
    </div>
  );
}
