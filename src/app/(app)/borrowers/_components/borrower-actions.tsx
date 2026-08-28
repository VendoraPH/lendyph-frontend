"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MoreHorizontal,
  Pencil,
  Trash2,
  UserCheck,
  UserX,
  AlertTriangle,
} from "lucide-react";
import type { Borrower } from "@/types";

// ── Toggle Status Dialog ──

export function ToggleStatusDialog({
  borrower,
  open,
  onOpenChange,
  onConfirm,
}: {
  borrower: Borrower;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  const isActive = borrower.status === "active";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-brand-orange" />
            {isActive ? "Deactivate" : "Activate"} Member
          </DialogTitle>
          <DialogDescription>
            {isActive
              ? `Are you sure you want to deactivate ${borrower.full_name}? They will be marked as inactive.`
              : `Are you sure you want to activate ${borrower.full_name}? They will regain active status.`}
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
            className={
              isActive
                ? "bg-destructive text-white hover:bg-destructive/90"
                : "bg-green-600 text-white hover:bg-green-700"
            }
          >
            {isActive ? "Deactivate" : "Activate"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Delete Borrower Dialog ──

export function DeleteBorrowerDialog({
  borrower,
  open,
  onOpenChange,
  onConfirm,
}: {
  borrower: Borrower;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" />
            Delete Member
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to permanently delete {borrower.full_name} (
            {borrower.borrower_code})? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            Delete
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Borrower Actions Cell ──

export function BorrowerActionsCell({
  borrower,
  onToggleStatus,
  onDelete,
}: {
  borrower: Borrower;
  onToggleStatus: () => void;
  onDelete: () => void;
}) {
  const router = useRouter();
  const [openDialog, setOpenDialog] = useState<string | null>(null);
  const isActive = borrower.status === "active";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="outline-none">
          <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={() => router.push(`/borrowers/${borrower.id}/edit`)}
          >
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setOpenDialog("status")}>
            {isActive ? (
              <UserX className="mr-2 h-4 w-4" />
            ) : (
              <UserCheck className="mr-2 h-4 w-4" />
            )}
            {isActive ? "Deactivate" : "Activate"}
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive"
            onClick={() => setOpenDialog("delete")}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ToggleStatusDialog
        borrower={borrower}
        open={openDialog === "status"}
        onOpenChange={(v) => !v && setOpenDialog(null)}
        onConfirm={onToggleStatus}
      />
      <DeleteBorrowerDialog
        borrower={borrower}
        open={openDialog === "delete"}
        onOpenChange={(v) => !v && setOpenDialog(null)}
        onConfirm={onDelete}
      />
    </>
  );
}
