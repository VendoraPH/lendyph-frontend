"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, ChevronsUpDown } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { gcashService } from "@/services/gcash.service";
import { useGCashTiers } from "@/hooks/use-gcash-tiers";
import { extractGCashErrorMessage } from "@/lib/gcash-errors";
import { formatCurrency } from "@/lib/format";
import type { Borrower, GCashTransactionType } from "@/types";

interface Props {
  open: boolean;
  onOpenChange(open: boolean): void;
  members: Borrower[];
  onCreated?(): void;
}

export function NewTransactionDialog({
  open,
  onOpenChange,
  members,
  onCreated,
}: Props) {
  const { resolveCharge, loading: tiersLoading } = useGCashTiers();
  const [memberOpen, setMemberOpen] = useState(false);
  const [memberId, setMemberId] = useState<number | null>(null);
  const [type, setType] = useState<GCashTransactionType>("cash_in");
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setMemberId(null);
      setType("cash_in");
      setAmount("");
    }
  }, [open]);

  const selectedMember = useMemo(
    () => members.find((m) => m.id === memberId) ?? null,
    [members, memberId],
  );

  const amountNum = Number(amount);
  const charge = useMemo(
    () =>
      Number.isFinite(amountNum) && amountNum > 0
        ? resolveCharge(amountNum, type)
        : null,
    [amountNum, resolveCharge, type],
  );
  const total =
    charge === null
      ? null
      : type === "cash_in"
        ? amountNum + charge
        : amountNum - charge;
  const canSubmit =
    !submitting &&
    selectedMember !== null &&
    amountNum > 0 &&
    charge !== null &&
    total !== null &&
    total >= 0 &&
    !tiersLoading;

  const handleSubmit = async () => {
    if (!canSubmit || !selectedMember) return;
    setSubmitting(true);
    try {
      const tx = await gcashService.createTransaction({
        borrower_id: selectedMember.id,
        type,
        amount: amountNum,
      });
      toast.success(
        `${type === "cash_in" ? "Cash In" : "Cash Out"} recorded. Reference: ${tx?.reference_no ?? "—"}`,
      );
      onCreated?.();
      onOpenChange(false);
    } catch (err) {
      toast.error(extractGCashErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Transaction</DialogTitle>
          <DialogDescription>
            Record a GCash Cash In or Cash Out for a member.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Popover open={memberOpen} onOpenChange={setMemberOpen}>
              <PopoverTrigger
                render={
                  <button
                    type="button"
                    role="combobox"
                    aria-expanded={memberOpen}
                    className="flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-3 text-sm transition-colors hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                  />
                }
              >
                <span
                  className={cn(
                    "truncate",
                    !selectedMember && "text-muted-foreground",
                  )}
                >
                  {selectedMember ? selectedMember.full_name : "Search member..."}
                </span>
                <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
              </PopoverTrigger>
              <PopoverContent className="w-(--anchor-width) p-0" align="start">
                <Command>
                  <CommandInput placeholder="Type a name to search..." />
                  <CommandList>
                    <CommandEmpty>No member found.</CommandEmpty>
                    <CommandGroup>
                      {members.map((m) => (
                        <CommandItem
                          key={m.id}
                          value={`${m.full_name} ${m.borrower_code}`}
                          onSelect={() => {
                            setMemberId(m.id === memberId ? null : m.id);
                            setMemberOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 size-4",
                              memberId === m.id ? "opacity-100" : "opacity-0",
                            )}
                          />
                          {m.full_name}{" "}
                          <span className="text-muted-foreground">
                            ({m.borrower_code})
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-1.5">
            <Label className="text-muted-foreground">Number</Label>
            <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
              {selectedMember?.contact_number ?? "—"}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="newtx-amount">Amount (₱)</Label>
              <Input
                id="newtx-amount"
                type="number"
                min={0}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="newtx-type">Transaction Type</Label>
              <Select
                value={type}
                onValueChange={(v) => setType(v as GCashTransactionType)}
              >
                <SelectTrigger id="newtx-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash_in">Cash In</SelectItem>
                  <SelectItem value="cash_out">Cash Out</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-muted-foreground">Charge</Label>
              <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
                {charge !== null ? formatCurrency(charge) : "—"}
              </div>
            </div>
            <div>
              <Label className="text-muted-foreground">Total</Label>
              <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm font-medium">
                {total !== null ? formatCurrency(total) : "—"}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {submitting ? "Saving…" : "Record Transaction"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
