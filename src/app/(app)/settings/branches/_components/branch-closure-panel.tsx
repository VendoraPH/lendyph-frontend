"use client";

import { useId, useState, type RefObject } from "react";
import { CheckCircle2, CircleAlert, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DataState } from "@/components/common/data-state";
import { DisabledReason } from "@/components/common/disabled-reason";
import { ReasonDialog } from "@/components/common/reason-dialog";
import type { ApiResource } from "@/hooks/use-api-resource";
import { useAuthStore } from "@/store";
import {
  checklistItemWords,
  closureActions,
  closureState,
  type BranchClosureInfo,
} from "@/lib/branch-closure";
import { formatDate, formatDateTime, todayISO } from "@/lib/format";
import { notifyError, notifySuccess } from "@/lib/notify";
import { cn } from "@/lib/utils";
import { branchService, type ApiBranch } from "@/services/branch.service";

type Dialog = "request" | "approve" | "reject" | null;

/**
 * Closing a branch: the server's checklist of what keeps it open, then a
 * request with an effective date, approved or rejected by a different user and
 * cancellable by the requester. Rendered only for branches:manage plus
 * branches:view_all, behind the multi-branch flag.
 */
export function BranchClosurePanel({
  branch,
  resource,
  onChanged,
  fallbackFocus,
}: {
  branch: ApiBranch;
  /** GET /branches/{id}/closure, read by the details dialog; `onChanged` refetches it. */
  resource: ApiResource<BranchClosureInfo>;
  onChanged: () => void;
  /**
   * Every closure action removes the button that started it, and the refresh
   * redraws this panel, so focus goes to this element (the dialog's title).
   */
  fallbackFocus: RefObject<HTMLElement | null>;
}) {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [effectiveOn, setEffectiveOn] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const dateId = useId();

  async function cancelRequest() {
    setCancelling(true);
    const ok = await branchService.cancelClosure(branch.id).then(
      () => true,
      (err: unknown) => {
        notifyError(err, "We couldn't cancel the request. Please try again.");
        return false;
      },
    );
    setCancelling(false);
    if (!ok) return;
    notifySuccess("Request to close cancelled");
    onChanged();
    fallbackFocus.current?.focus();
  }

  return (
    <section aria-labelledby={`${dateId}-title`} className="space-y-3">
      <h3 id={`${dateId}-title`} className="text-sm font-semibold">
        Closing this branch
      </h3>
      <DataState
        resource={resource}
        endpoints={["GET /branches/{id}/closure"]}
        summary="The closure checklist shows here once the server provides it."
      >
        {(info) => {
          const actions = closureActions(info, branch, userId, true);
          const waiting = info.request?.status === "pending" ? info.request : null;
          return (
            <div className="space-y-3">
              <p className="text-sm" role="status">
                {closureState(info, branch)}
              </p>

              {info.status !== "closed" && (
                <ul className="divide-y rounded-lg border" aria-label="What keeps this branch open">
                  {info.checklist.map((item) => (
                    <li key={item.key} className="flex items-center gap-2 px-3 py-2 text-sm">
                      {item.clear ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" aria-hidden="true" />
                      ) : (
                        <CircleAlert className="h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
                      )}
                      <span className={cn(item.clear && "text-muted-foreground")}>{checklistItemWords(item)}</span>
                      <span className="sr-only">{item.clear ? "(clear)" : "(keeps the branch open)"}</span>
                    </li>
                  ))}
                </ul>
              )}

              {waiting && (
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-lg border bg-muted/40 p-3 text-sm">
                  <dt className="text-muted-foreground">Requested by</dt>
                  <dd>{waiting.requested_by?.full_name ?? "—"}</dd>
                  <dt className="text-muted-foreground">Requested on</dt>
                  <dd>{waiting.requested_at ? formatDateTime(waiting.requested_at) : "—"}</dd>
                  <dt className="text-muted-foreground">Closing date</dt>
                  <dd>{waiting.effective_on ? formatDate(waiting.effective_on) : "—"}</dd>
                  <dt className="text-muted-foreground">Reason</dt>
                  <dd className="whitespace-pre-wrap break-words">{waiting.reason}</dd>
                </dl>
              )}

              <div className="flex flex-wrap gap-2">
                {actions.request && (
                  <DisabledReason reason={actions.requestDisabledReason}>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive border-destructive/30 hover:bg-destructive/5"
                      disabled={actions.requestDisabledReason !== null}
                      onClick={() => {
                        setEffectiveOn(todayISO());
                        setDialog("request");
                      }}
                    >
                      Ask to close
                    </Button>
                  </DisabledReason>
                )}
                {actions.approve && (
                  <Button size="sm" onClick={() => setDialog("approve")}>
                    Approve closing
                  </Button>
                )}
                {actions.reject && (
                  <Button variant="outline" size="sm" onClick={() => setDialog("reject")}>
                    Reject
                  </Button>
                )}
                {actions.cancel && (
                  <Button variant="outline" size="sm" disabled={cancelling} onClick={cancelRequest}>
                    {cancelling && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                    Cancel my request
                  </Button>
                )}
              </div>
              {actions.cancel && (
                <p className="text-xs text-muted-foreground">
                  You asked to close this branch, so someone else approves or rejects it.
                </p>
              )}
            </div>
          );
        }}
      </DataState>

      <ReasonDialog
        open={dialog === "request"}
        onOpenChange={(open) => !open && setDialog(null)}
        title={`Ask to close ${branch.name}`}
        description="A different user approves it. The server checks the checklist again before the branch closes, and the request goes into the audit trail."
        confirmLabel="Ask to close"
        fallbackFocus={fallbackFocus}
        destructive
        missingFields={effectiveOn ? [] : ["Closing date"]}
        onConfirm={async (reason) => {
          await branchService.requestClosure(branch.id, { effective_on: effectiveOn, reason });
          notifySuccess("Request to close sent for approval");
          onChanged();
        }}
      >
        <div className="space-y-2">
          <Label htmlFor={dateId}>
            Closing date <span className="text-destructive">*</span>
          </Label>
          <Input
            id={dateId}
            type="date"
            max={todayISO()}
            min={branch.opened_on ?? undefined}
            value={effectiveOn}
            onChange={(e) => setEffectiveOn(e.target.value)}
            required
            aria-describedby={`${dateId}-hint`}
          />
          <p id={`${dateId}-hint`} className="text-xs text-muted-foreground">
            Today or earlier, not before the branch opened.
          </p>
        </div>
      </ReasonDialog>

      <ReasonDialog
        open={dialog === "approve"}
        onOpenChange={(open) => !open && setDialog(null)}
        title={`Approve closing ${branch.name}`}
        description="The branch closes on the requested date and takes nothing new after that. This can't be undone."
        confirmLabel="Approve closing"
        fallbackFocus={fallbackFocus}
        reasonLabel="Note"
        reasonRequired={false}
        destructive
        onConfirm={async (note) => {
          await branchService.approveClosure(branch.id, { note: note || null });
          notifySuccess(`${branch.name} is closed`);
          onChanged();
        }}
      />

      <ReasonDialog
        open={dialog === "reject"}
        onOpenChange={(open) => !open && setDialog(null)}
        title={`Reject closing ${branch.name}`}
        description="The branch stays open. The note goes into the audit trail."
        confirmLabel="Reject"
        fallbackFocus={fallbackFocus}
        reasonLabel="Note"
        onConfirm={async (note) => {
          await branchService.rejectClosure(branch.id, { note });
          notifySuccess("Request to close rejected");
          onChanged();
        }}
      />
    </section>
  );
}
