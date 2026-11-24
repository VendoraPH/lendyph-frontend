"use client";

import { useCallback, useState } from "react";
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
import { env } from "@/config/env";
import { useApiResource } from "@/hooks/use-api-resource";
import { useSubmitGuard } from "@/hooks/use-submit-guard";
import { formatDate } from "@/lib/format";
import { notifyError, notifySuccess, notifyWarning } from "@/lib/notify";
import { shareLinkStatusText, shareLinkUrl } from "@/lib/receipt-share";
import { receiptShareLinkService } from "@/services/receipt-share-link.service";
import type { ReceiptShareLinkCreated } from "@/types/receipt-share";

/**
 * "Share link" beside Download Image on a payment receipt (finish run round 2,
 * decision 6). Shown only while NEXT_PUBLIC_ENABLE_RECEIPT_SHARE_LINKS is on
 * AND the server answers the receipt's link status, so a server with the
 * switch off (404), or a refusal, shows no button at all.
 *
 * Making a link shows it once, with Copy: only the token's hash is kept, so
 * closing the dialog forgets it. A working link can be revoked; a new one can
 * be made once none is working.
 */
export function ShareReceiptLink({ repaymentId }: { repaymentId: number }) {
  const fetchStatus = useCallback(() => receiptShareLinkService.status(repaymentId), [repaymentId]);
  const status = useApiResource(fetchStatus, env.features.receiptShareLinks);
  const [open, setOpen] = useState(false);
  const [created, setCreated] = useState<ReceiptShareLinkCreated | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const { submitting, run } = useSubmitGuard();

  if (!status.data) return null;

  const link = status.data.link;
  // Just made counts as working before the status reads it back, so it is never offered twice.
  const working = created !== null || link?.status === "active";
  const url = created ? shareLinkUrl(window.location.origin, created.token) : null;

  function close(next: boolean) {
    if (submitting) return;
    setOpen(next);
    if (!next) {
      setCreated(null);
      setConfirmRevoke(false);
    }
  }

  function make() {
    run(() => receiptShareLinkService.create(repaymentId))
      ?.then((result) => {
        setCreated(result);
        status.refetch();
      })
      .catch((err: unknown) => {
        // Someone else may have made or revoked a link meanwhile: show where it stands now.
        status.refetch();
        notifyError(err, "We couldn't make the share link. Please try again.");
      });
  }

  function revoke() {
    run(() => receiptShareLinkService.revoke(repaymentId))
      ?.then(() => {
        setCreated(null);
        setConfirmRevoke(false);
        status.refetch();
        notifySuccess("Share link revoked", "It no longer opens this receipt.");
      })
      .catch((err: unknown) => {
        setConfirmRevoke(false);
        status.refetch();
        notifyError(err, "We couldn't revoke the share link. Please try again.");
      });
  }

  function copy() {
    if (!url) return;
    const refused = () => notifyWarning("This browser didn't allow copying. Select the link and copy it.");
    if (!navigator.clipboard) {
      refused();
      return;
    }
    navigator.clipboard
      .writeText(url)
      .then(() => notifySuccess("Link copied"))
      .catch(refused);
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Link2 className="mr-2 h-4 w-4" />
        Share link
      </Button>

      <Dialog open={open} onOpenChange={close}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share this receipt</DialogTitle>
            <DialogDescription>
              Anyone with the link can open this receipt for 30 days without signing in. It shows the member&apos;s
              initials and surname, the amount paid and its breakdown, and the payment method. Never contact details,
              account numbers or balances.
            </DialogDescription>
          </DialogHeader>

          {url && created ? (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input readOnly value={url} aria-label="Share link" onFocus={(e) => e.currentTarget.select()} />
                <Button variant="outline" onClick={copy}>
                  <Copy className="h-4 w-4" aria-hidden /> Copy
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Copy it now: it can&apos;t be shown again. It works until {formatDate(created.link.expires_at)}.
              </p>
            </div>
          ) : (
            link && <p className="text-sm text-muted-foreground">{shareLinkStatusText(link)}</p>
          )}

          {working && !created && (
            <p className="text-sm text-muted-foreground">
              A working link can&apos;t be shown again. To share this receipt again, revoke it and make a new one.
            </p>
          )}

          {confirmRevoke && (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive" role="alert">
              Revoke this link? Anyone who has it can no longer open the receipt.
            </p>
          )}

          <DialogFooter>
            {working && !confirmRevoke && (
              <Button variant="outline" onClick={() => setConfirmRevoke(true)} disabled={submitting}>
                Revoke link
              </Button>
            )}
            {working && confirmRevoke && (
              <>
                <Button variant="outline" onClick={() => setConfirmRevoke(false)} disabled={submitting}>
                  Keep it
                </Button>
                <Button variant="destructive" onClick={revoke} disabled={submitting}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Revoke
                </Button>
              </>
            )}
            {!working && (
              <Button onClick={make} disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Make link
              </Button>
            )}
            {!confirmRevoke && (
              <Button variant={working ? "default" : "outline"} onClick={() => close(false)} disabled={submitting}>
                {created ? "Done" : "Close"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
