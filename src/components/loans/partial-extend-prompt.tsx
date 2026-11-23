"use client";

import { CalendarPlus, Loader2 } from "lucide-react";
import { PermissionButton } from "@/components/common/permission-button";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { LOAN_EXTEND_GATE } from "@/lib/lending-write-gates";
import {
  PARTIAL_EXTEND_LABELS,
  partialExtendOnOpenChange,
  type PartialExtendChoice,
} from "@/lib/partial-extend";

/**
 * "Extend loan?", asked before a partial payment on a loan that can be
 * extended is recorded (offersExtendOnPartialPayment), on the loan page and
 * on Payment Entry. Each button is one choice, and closing the prompt any
 * other way is Cancel. "Yes, extend" needs `loans:extend`, as the server
 * does, so a cashier without it can still record the payment or cancel.
 */
export function PartialExtendPrompt({
  open,
  busy,
  onChoice,
}: {
  open: boolean;
  /** A payment or an extension is on its way: every button waits. */
  busy: boolean;
  onChoice: (choice: PartialExtendChoice) => void;
}) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        const choice = partialExtendOnOpenChange(next);
        if (choice !== null) onChoice(choice);
      }}
    >
      {/* Three buttons don't fit the default width: widen it from sm up and
          let the row wrap; below sm the footer stacks them full width. */}
      <AlertDialogContent className="data-[size=default]:sm:max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>Extend loan?</AlertDialogTitle>
          <AlertDialogDescription>
            Payment is not enough to fully settle this loan.{" "}
            <span className="font-medium">{PARTIAL_EXTEND_LABELS.extend}</span> records the
            payment and extends the loan: the remaining principal and interest carry
            over to the next cycle.{" "}
            <span className="font-medium">{PARTIAL_EXTEND_LABELS.record}</span> records the
            payment without extending.{" "}
            <span className="font-medium">{PARTIAL_EXTEND_LABELS.cancel}</span> records
            nothing and takes you back to the payment form.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="sm:flex-wrap">
          <AlertDialogCancel disabled={busy} onClick={() => onChoice("cancel")}>
            {PARTIAL_EXTEND_LABELS.cancel}
          </AlertDialogCancel>
          <Button variant="outline" disabled={busy} onClick={() => onChoice("record")}>
            {PARTIAL_EXTEND_LABELS.record}
          </Button>
          <PermissionButton
            permission={LOAN_EXTEND_GATE.permission}
            tooltip={LOAN_EXTEND_GATE.tooltip}
            disabled={busy}
            onClick={() => onChoice("extend")}
            className="bg-brand-blue text-brand-blue-foreground shadow-sm hover:bg-brand-blue-dark hover:shadow-md transition-all"
          >
            {busy ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Extending...
              </>
            ) : (
              <>
                <CalendarPlus className="mr-2 h-4 w-4" />
                {PARTIAL_EXTEND_LABELS.extend}
              </>
            )}
          </PermissionButton>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
