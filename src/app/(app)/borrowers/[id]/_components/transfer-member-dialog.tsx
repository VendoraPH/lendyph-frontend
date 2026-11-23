"use client";

import { useId, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useBranches, useDialogOpening } from "@/hooks";
import { notifySuccess } from "@/lib/notify";
import { userBranches } from "@/lib/user-branches";
import { borrowerService } from "@/services";
import { useAuthStore } from "@/store";
import type { Borrower } from "@/types";
import {
  REASON_MAX,
  memberBranchId,
  transferDestinations,
  transferFailure,
  transferRequest,
  type TransferBranch,
} from "../../_lib/member-transfer";

interface TransferMemberDialogProps {
  borrower: Borrower;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** After the move: the page reloads and shows the new branch. */
  onTransferred: () => void;
}

/** The form's messages, and what a refused transfer leaves the user to do (`transferFailure`). */
interface DialogErrors {
  branch_id?: string;
  reason?: string;
  general?: string;
  retry?: boolean;
  outOfReach?: boolean;
}

/**
 * Moves the member to another branch (Phase 6 MB-BE4). The server refuses it,
 * in words, while the member still has a loan or loan application, savings
 * account, time deposit, portal request or unpaid GCash Cash In open; the
 * refusal shows here as sent. A 409 (the member busy or changed at the same
 * moment) offers Try again; after a 404 (the member outside the caller's
 * branches now) Transfer member stays disabled. Past records stay in the
 * branch where they were posted.
 */
export function TransferMemberDialog({ borrower, open, onOpenChange, onTransferred }: TransferMemberDialogProps) {
  const id = useId();
  const { branches, loading, error: loadError } = useBranches(open);
  const caller = useAuthStore((s) => s.user);
  const viewAll = useAuthStore((s) => s.hasPermission("branches:view_all"));
  const currentId = memberBranchId(borrower);
  const destinations = useMemo(
    () =>
      transferDestinations<TransferBranch>(branches, { viewAll, own: userBranches(caller) }, currentId),
    [branches, caller, viewAll, currentId],
  );

  const [branchValue, setBranchValue] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<DialogErrors>({});
  const [busy, setBusy] = useState(false);
  if (useDialogOpening(open, null)) {
    setBranchValue(null);
    setReason("");
    setErrors({});
  }

  const selected = destinations.find((b) => String(b.id) === branchValue) ?? null;
  const branchMessage =
    errors.branch_id ??
    (loadError
      ? "Branches could not be loaded. Close this and try again."
      : !loading && destinations.length === 0
        ? "There's no other active branch you can move this member to."
        : null);

  async function submit() {
    const request = transferRequest(branchValue, reason);
    if (!request.ok) {
      setErrors(request.errors);
      return;
    }
    setBusy(true);
    setErrors({});
    try {
      await borrowerService.transfer(borrower.id, request.body);
      notifySuccess(`${borrower.full_name} was moved to ${selected?.name ?? "the new branch"}.`);
      onOpenChange(false);
      onTransferred();
    } catch (err) {
      const failure = transferFailure(err);
      setErrors({
        reason: failure.reason ?? undefined,
        general: failure.general ?? undefined,
        retry: failure.retry,
        outOfReach: failure.outOfReach,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Transfer member</DialogTitle>
          <DialogDescription>
            Moves {borrower.full_name} from {borrower.branch?.name ?? "their branch"} to another branch. Their
            earlier records stay in the branch where they were posted. A member with a loan or loan application,
            savings account, time deposit or portal request still open, or a GCash Cash In not yet paid, can&apos;t be
            moved.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5" data-field="branch_id">
            <Label htmlFor={`${id}-branch`}>
              Move to <span className="text-destructive" aria-hidden="true">*</span>
            </Label>
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
                <Spinner />
                Loading branches…
              </div>
            ) : (
              <Select
                value={branchValue ?? ""}
                onValueChange={(next: string | null) => {
                  setBranchValue(next || null);
                  setErrors((e) => ({ ...e, branch_id: undefined }));
                }}
                disabled={busy || destinations.length === 0}
              >
                <SelectTrigger
                  id={`${id}-branch`}
                  className="w-full"
                  aria-required="true"
                  aria-invalid={branchMessage ? true : undefined}
                  aria-describedby={branchMessage ? `${id}-branch-error` : undefined}
                >
                  <SelectValue>{() => selected?.name ?? "Choose a branch…"}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {destinations.map((b) => (
                    <SelectItem key={b.id} value={String(b.id)}>
                      {b.name}
                      {b.code ? ` (${b.code})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {branchMessage ? (
              <p id={`${id}-branch-error`} className="text-xs text-destructive" role="alert">
                {branchMessage}
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5" data-field="reason">
            <Label htmlFor={`${id}-reason`}>
              Reason <span className="text-destructive" aria-hidden="true">*</span>
            </Label>
            <Textarea
              id={`${id}-reason`}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setErrors((prev) => ({ ...prev, reason: undefined }));
              }}
              maxLength={REASON_MAX}
              rows={3}
              disabled={busy}
              aria-required="true"
              aria-invalid={errors.reason ? true : undefined}
              aria-describedby={`${id}-reason-hint${errors.reason ? ` ${id}-reason-error` : ""}`}
              placeholder="Why the member is moving"
            />
            {errors.reason ? (
              <p id={`${id}-reason-error`} className="text-xs text-destructive" role="alert">
                {errors.reason}
              </p>
            ) : null}
            <p id={`${id}-reason-hint`} className="text-[11px] text-muted-foreground">
              Kept in the audit trail. {reason.length} of {REASON_MAX} characters.
            </p>
          </div>

          {errors.general ? (
            <div
              role="alert"
              className="flex flex-col gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 sm:flex-row sm:items-start sm:justify-between"
            >
              <p className="text-sm text-destructive">{errors.general}</p>
              {errors.retry ? (
                <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={submit}>
                  Try again
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={busy || loading || destinations.length === 0 || errors.outOfReach}
            className="bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark"
          >
            {busy ? "Transferring…" : "Transfer member"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
