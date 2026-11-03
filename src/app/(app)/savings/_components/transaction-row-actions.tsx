"use client";

import type { ReactNode } from "react";
import { Check, Printer, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { SavingsTransaction } from "@/types/savings";
import { transactionRowActions } from "../_lib/account-status";
import type { ReversalAction } from "./reversal-dialogs";

interface TransactionRowActionsProps {
  tx: SavingsTransaction;
  user: { canReverse: boolean; canApprove: boolean; userId: number | null };
  onPrint: (tx: SavingsTransaction) => void;
  printing: boolean;
  onAction: (action: ReversalAction, tx: SavingsTransaction) => void;
}

function IconAction({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClick} disabled={disabled} aria-label={label} />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/** Print, reverse, and approve or reject a pending reversal, as allowed. */
export function TransactionRowActions({ tx, user, onPrint, printing, onAction }: TransactionRowActionsProps) {
  const actions = transactionRowActions(tx, user);
  const own = actions.review?.ownRequest ?? false;
  return (
    <div className="flex justify-end gap-1">
      <IconAction label="Print receipt" onClick={() => onPrint(tx)} disabled={printing}>
        <Printer className="h-4 w-4" />
      </IconAction>
      {actions.reverse && (
        <IconAction label="Reverse" onClick={() => onAction("reverse", tx)}>
          <Undo2 className="h-4 w-4" />
        </IconAction>
      )}
      {actions.review && (
        <>
          <IconAction
            label={own ? "You requested this reversal; another user must approve it" : "Approve reversal"}
            onClick={() => onAction("approve", tx)}
            disabled={own}
          >
            <Check className="h-4 w-4 text-emerald-600" />
          </IconAction>
          <IconAction
            label={own ? "You requested this reversal; another user must review it" : "Reject reversal"}
            onClick={() => onAction("reject", tx)}
            disabled={own}
          >
            <X className="h-4 w-4 text-destructive" />
          </IconAction>
        </>
      )}
    </div>
  );
}
