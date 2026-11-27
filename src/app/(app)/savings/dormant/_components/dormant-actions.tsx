"use client";

import { useState } from "react";
import Link from "next/link";
import { Eye, Hand, MessageSquareText, RotateCcw } from "lucide-react";
import { PermissionButton } from "@/components/common/permission-button";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { notifyError } from "@/lib/notify";
import { savingsService } from "@/services";
import type { SavingsAccount } from "@/types";
import { AccountNotesPanel } from "../../accounts/[id]/_components/account-notes-panel";
import { PlaceHoldDialog } from "../../accounts/[id]/_components/place-hold-dialog";
import { StatusDialog } from "../../accounts/[id]/_components/status-dialog";

type Opening = "reactivate" | "hold";

/**
 * A row's actions on the dormancy screen: view the account, ask for its
 * reactivation (a checker approves it), restrict withdrawals with a staff
 * hold, and read or add notes. The account is read fresh before a dialog
 * opens, so the dialogs show the server's current figures.
 */
export function DormantActions({
  accountId,
  accountNumber,
  dormant,
  onChanged,
}: {
  accountId: number;
  accountNumber: string;
  /** Reactivation is offered on a dormant account only. */
  dormant: boolean;
  onChanged: () => void;
}) {
  const [account, setAccount] = useState<SavingsAccount | null>(null);
  const [opening, setOpening] = useState<Opening | null>(null);
  const [loading, setLoading] = useState<Opening | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);

  const open = (what: Opening) => {
    setLoading(what);
    savingsService
      .account(accountId)
      .then((fresh) => {
        setAccount(fresh);
        setOpening(what);
      })
      .catch((err: unknown) => notifyError(err, "Couldn't load the account."))
      .then(() => setLoading(null));
  };
  const close = () => setOpening(null);

  return (
    <div className="flex justify-end gap-1">
      <Button
        size="sm"
        variant="ghost"
        nativeButton={false}
        render={<Link href={`/savings/accounts/${accountId}`} />}
        aria-label={`View ${accountNumber}`}
        title="View account"
      >
        <Eye className="h-4 w-4" />
      </Button>
      {dormant && (
        <PermissionButton
          permission="savings:close"
          size="sm"
          variant="ghost"
          disabled={loading !== null}
          onClick={() => open("reactivate")}
          aria-label={`Ask to reactivate ${accountNumber}`}
          title="Reactivate (sent for approval)"
        >
          <RotateCcw className="h-4 w-4" />
        </PermissionButton>
      )}
      <PermissionButton
        permission="savings:transact"
        size="sm"
        variant="ghost"
        disabled={loading !== null}
        onClick={() => open("hold")}
        aria-label={`Restrict withdrawals on ${accountNumber}`}
        title="Restrict withdrawals (place a hold)"
      >
        <Hand className="h-4 w-4" />
      </PermissionButton>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setNotesOpen(true)}
        aria-label={`Notes on ${accountNumber}`}
        title="Notes"
      >
        <MessageSquareText className="h-4 w-4" />
      </Button>

      {account && (
        <>
          <StatusDialog
            offer={opening === "reactivate" ? { status: "active", label: "Reactivate" } : null}
            account={account}
            onOpenChange={(o) => !o && close()}
            onChanged={onChanged}
          />
          <PlaceHoldDialog
            open={opening === "hold"}
            account={account}
            onOpenChange={(o) => !o && close()}
            onPlaced={onChanged}
          />
        </>
      )}
      <Dialog open={notesOpen} onOpenChange={setNotesOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Notes on {accountNumber}</DialogTitle>
            <DialogDescription>Newest first. Notes are kept on the account&apos;s record.</DialogDescription>
          </DialogHeader>
          {notesOpen && <AccountNotesPanel accountId={accountId} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
