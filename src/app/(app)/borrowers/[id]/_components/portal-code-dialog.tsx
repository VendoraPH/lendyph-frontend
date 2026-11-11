"use client";

import { useState } from "react";
import { Copy, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useDialogOpening } from "@/hooks";
import { useSubmitGuard } from "@/hooks/use-submit-guard";
import { notifySuccess, notifyWarning } from "@/lib/notify";
import { portalAdminService } from "@/services/portal-admin.service";
import { useBrandingStore } from "@/store/branding-store";
import type { PortalCodeKind, PortalIdentityType, PortalIssuedCode } from "@/types/portal-admin";
import { OptionSelect } from "@/app/(app)/savings/_components/option-select";
import { CODE_KIND_LABELS, IDENTITY_TYPE_LABELS, optionsOf } from "@/app/(app)/member-portal/_lib/labels";
import { notifyPortalError } from "@/app/(app)/member-portal/_lib/notify-portal-error";
import { printCodeSlip } from "@/app/(app)/member-portal/_lib/print-slip";
import { issueCodeTitle } from "@/app/(app)/member-portal/_lib/access-rules";
import { closeAllowed, createCodeAttempts } from "@/app/(app)/member-portal/_lib/code-attempts";

const ID_OPTIONS = optionsOf(IDENTITY_TYPE_LABELS);

interface PortalCodeDialogProps {
  /** The code to issue, or null while closed. */
  kind: PortalCodeKind | null;
  borrowerId: number;
  memberName: string;
  onOpenChange: (open: boolean) => void;
  onIssued: () => void;
}

/**
 * Issue an activation or password reset code. Staff tick that they checked
 * the member's valid ID and say which; the server then answers with the code
 * once. It shows here with Copy and Print slip, and is gone when the dialog
 * closes: it can't be read again. Adapted from #511 by Augustin (the invite
 * button), now a code instead of an emailed link.
 */
export function PortalCodeDialog({ kind, borrowerId, memberName, onOpenChange, onIssued }: PortalCodeDialogProps) {
  const open = kind !== null;
  const [checked, setChecked] = useState(false);
  const [idType, setIdType] = useState("");
  const [issued, setIssued] = useState<PortalIssuedCode | null>(null);
  const { submitting, run } = useSubmitGuard();
  const [attempts] = useState(createCodeAttempts);
  const cooperative = useBrandingStore((s) => s.organizationName) ?? "";
  if (useDialogOpening(open, kind)) {
    setChecked(false);
    setIdType("");
    setIssued(null);
    attempts.cancel();
  }

  const ready = checked && idType !== "";

  function issue() {
    if (!kind || !ready) return;
    const call = kind === "activation" ? portalAdminService.invite : portalAdminService.resetCode;
    const attempt = attempts.begin();
    run(() => call(borrowerId, idType as PortalIdentityType))
      ?.then((result) => {
        // The card refreshes either way: the member's earlier code was replaced.
        onIssued();
        if (attempts.isCurrent(attempt)) setIssued(result);
      })
      .catch((err: unknown) => notifyPortalError(err, "The code couldn't be issued. Please try again."));
  }

  function close(next: boolean) {
    if (!closeAllowed(next, submitting)) return;
    if (!next) {
      attempts.cancel();
      setIssued(null);
    }
    onOpenChange(next);
  }

  function copy() {
    if (!issued) return;
    const refused = () => notifyWarning("This browser didn't allow copying. Read the code out or print the slip.");
    if (!navigator.clipboard) {
      refused();
      return;
    }
    navigator.clipboard
      .writeText(issued.code)
      .then(() => notifySuccess("Code copied"))
      .catch(refused);
  }

  const title = kind ? CODE_KIND_LABELS[kind] : "Code";

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{issued ? `${title} for ${memberName}` : issueCodeTitle(kind ?? "activation")}</DialogTitle>
          <DialogDescription>
            {issued
              ? "This code is shown once. Hand it to the member or print the slip now: it can't be shown again."
              : kind === "reset"
                ? "The member uses it to choose a new password. Every device they're signed in on is signed out when they do."
                : "The member uses it with their member number and birthdate to set up their portal password. Any earlier code stops working."}
          </DialogDescription>
        </DialogHeader>

        {issued ? (
          <div className="space-y-3">
            <p
              className="rounded-md border bg-muted/40 py-4 text-center font-mono text-2xl tracking-widest"
              aria-label={`Code ${issued.code.split("").join(" ")}`}
            >
              {issued.code}
            </p>
            <p className="text-sm text-muted-foreground">Valid until {issued.slip.expires_at_text}.</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={copy}>
                <Copy className="h-4 w-4" aria-hidden /> Copy
              </Button>
              <Button variant="outline" size="sm" onClick={() => printCodeSlip(issued.slip, cooperative)}>
                <Printer className="h-4 w-4" aria-hidden /> Print slip
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start gap-2">
              <Checkbox
                id="portal-id-checked"
                checked={checked}
                onCheckedChange={(v) => setChecked(v === true)}
                className="mt-0.5"
              />
              <Label htmlFor="portal-id-checked" className="font-normal leading-snug">
                I checked the member&apos;s valid ID in person.
              </Label>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="portal-id-type">Valid ID checked</Label>
              <OptionSelect
                id="portal-id-type"
                value={idType}
                onChange={setIdType}
                options={ID_OPTIONS}
                placeholder="Choose the ID"
              />
            </div>
          </div>
        )}

        <DialogFooter>
          {issued ? (
            <Button onClick={() => close(false)}>Done</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => close(false)} disabled={submitting}>
                Cancel
              </Button>
              <Button onClick={issue} disabled={!ready || submitting}>
                {submitting ? "Issuing…" : "Issue code"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
