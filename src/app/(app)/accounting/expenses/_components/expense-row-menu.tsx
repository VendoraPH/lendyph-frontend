"use client";

import { useId } from "react";
import { MoreHorizontal, Paperclip, Pencil, Receipt, Undo2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Expense } from "@/types";
import { moreActionsLabel, type ExpenseMenu } from "../_lib/expense-actions";

interface ExpenseRowMenuProps {
  expense: Expense;
  /** What the menu holds (`expenseMenu()`), from the server's flags and the user's permissions. */
  menu: ExpenseMenu;
  onPayments: (expense: Expense) => void;
  onEdit: (expense: Expense) => void;
  onReverse: (expense: Expense) => void;
  onAttachments: (expense: Expense) => void;
}

/**
 * A row's secondary actions behind one More button, so the Actions column
 * stays narrow. The menu opens from the keyboard (Enter, Space, arrows),
 * closes on Escape and hands focus back to the button. Reverse expense,
 * while payments stand, is shown disabled with the server's reason under it,
 * read out as the item's description.
 */
export function ExpenseRowMenu({ expense, menu, onPayments, onEdit, onReverse, onAttachments }: ExpenseRowMenuProps) {
  const reasonId = useId();
  const reason = menu.reverse.disabledReason;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="inline-flex size-7 items-center justify-center rounded-md outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
        aria-label={moreActionsLabel(expense.payee)}
      >
        <MoreHorizontal className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {menu.payments && (
          <DropdownMenuItem onClick={() => onPayments(expense)}>
            <Receipt className="mr-2 h-4 w-4" aria-hidden="true" />
            Payments
          </DropdownMenuItem>
        )}
        {menu.edit && (
          <DropdownMenuItem onClick={() => onEdit(expense)}>
            <Pencil className="mr-2 h-4 w-4" aria-hidden="true" />
            Edit
          </DropdownMenuItem>
        )}
        {menu.reverse.shown &&
          (reason === null ? (
            <DropdownMenuItem onClick={() => onReverse(expense)}>
              <Undo2 className="mr-2 h-4 w-4" aria-hidden="true" />
              Reverse expense
            </DropdownMenuItem>
          ) : (
            // Base UI keeps a disabled item reachable with the arrow keys, so
            // its reason is read as it is reached. The label sits in a group,
            // as Base UI requires.
            <DropdownMenuGroup>
              <DropdownMenuItem disabled aria-describedby={reasonId}>
                <Undo2 className="mr-2 h-4 w-4" aria-hidden="true" />
                Reverse expense
              </DropdownMenuItem>
              <DropdownMenuLabel id={reasonId} className="pl-8 text-xs font-normal text-muted-foreground">
                {reason}
              </DropdownMenuLabel>
            </DropdownMenuGroup>
          ))}
        {(menu.payments || menu.edit || menu.reverse.shown) && <DropdownMenuSeparator />}
        <DropdownMenuItem onClick={() => onAttachments(expense)}>
          <Paperclip className="mr-2 h-4 w-4" aria-hidden="true" />
          Attachments
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
