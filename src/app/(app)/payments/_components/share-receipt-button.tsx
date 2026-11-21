"use client";

import { useState } from "react";
import { Copy, Link2, Loader2 } from "lucide-react";
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
import { formatDate } from "@/lib/format";
import { getErrorMessage } from "@/lib/api-error";
import { notifySuccess, notifyWarning } from "@/lib/notify";
import { repaymentService } from "@/services";
import { receiptShareUrl } from "../_lib/receipt-data";

type ShareState =
  | { kind: "loading" }
  | { kind: "ready"; url: string; expiresAt: string | null }
  | { kind: "failed"; message: string };

function shareFailure(err: unknown): string {
  const status = (err as { response?: { status?: number } })?.response?.status;
  if (status === 404 || status === 501) return "Sharing receipts is not connected yet on this server.";
  return getErrorMessage(err, "We couldn't create the share link. Please try again.");
}

/** Issues the receipt's public link and offers it to copy. */
export function ShareReceiptButton({ repaymentId, voided }: { repaymentId: number; voided: boolean }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<ShareState>({ kind: "loading" });

  function share() {
    setOpen(true);
    setState({ kind: "loading" });
    repaymentService
      .shareLink(repaymentId)
      .then((link) =>
        setState({
          kind: "ready",
          url: receiptShareUrl(window.location.origin, link.token),
          expiresAt: link.expires_at,
        }),
      )
      .catch((err) => setState({ kind: "failed", message: shareFailure(err) }));
  }

  function copy() {
    if (state.kind !== "ready") return;
    const refused = () => notifyWarning("This browser didn't allow copying. Select the link and copy it.");
    if (!navigator.clipboard) {
      refused();
      return;
    }
    navigator.clipboard
      .writeText(state.url)
      .then(() => notifySuccess("Link copied"))
      .catch(refused);
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={share}>
        <Link2 className="mr-2 h-4 w-4" />
        Share Link
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Share receipt</DialogTitle>
            <DialogDescription>
              Anyone with this link can view and download this receipt without signing in. It shows
              this receipt only, with account numbers masked.
              {voided && " The receipt is voided, and the link says so."}
            </DialogDescription>
          </DialogHeader>

          {state.kind === "loading" && (
            <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Creating link…
            </div>
          )}
          {state.kind === "failed" && <p className="py-2 text-sm text-destructive">{state.message}</p>}
          {state.kind === "ready" && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={state.url}
                  aria-label="Receipt link"
                  onFocus={(e) => e.currentTarget.select()}
                  className="font-mono text-xs"
                />
                <Button size="sm" onClick={copy} className="shrink-0">
                  <Copy className="mr-2 h-4 w-4" />
                  Copy
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {state.expiresAt ? `The link works until ${formatDate(state.expiresAt)}.` : "The link does not expire."}
              </p>
            </div>
          )}

          <DialogFooter>
            {state.kind === "failed" && (
              <Button variant="outline" onClick={share}>
                Try again
              </Button>
            )}
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
