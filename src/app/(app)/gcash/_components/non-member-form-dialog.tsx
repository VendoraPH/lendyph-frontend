"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { gcashService } from "@/services/gcash.service";
import { extractGCashErrorMessage } from "@/lib/gcash-errors";
import type { GCashNonMember } from "@/types";

const ID_TYPES = [
  "UMID",
  "SSS",
  "PhilSys / National ID",
  "Driver's License",
  "Passport",
  "PhilHealth",
  "Postal ID",
  "Voter's ID",
  "Barangay ID",
  "Other",
] as const;

interface Props {
  open: boolean;
  onOpenChange(open: boolean): void;
  /** Omit to add a new walk-in; pass a row to edit it. */
  nonMember?: GCashNonMember | null;
  onSaved?(): void;
}

interface FormState {
  full_name: string;
  mobile_number: string;
  id_type: string;
  id_number: string;
  remarks: string;
}

const EMPTY: FormState = {
  full_name: "",
  mobile_number: "",
  id_type: "",
  id_number: "",
  remarks: "",
};

export function NonMemberFormDialog({
  open,
  onOpenChange,
  nonMember,
  onSaved,
}: Props) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const isEdit = Boolean(nonMember);

  useEffect(() => {
    if (!open) return;
    setForm(
      nonMember
        ? {
            full_name: nonMember.full_name ?? "",
            mobile_number: nonMember.mobile_number ?? "",
            id_type: nonMember.id_type ?? "",
            id_number: nonMember.id_number ?? "",
            remarks: nonMember.remarks ?? "",
          }
        : EMPTY,
    );
  }, [open, nonMember]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const name = form.full_name.trim();
  const mobile = form.mobile_number.trim();
  const idType = form.id_type.trim();
  const idNumber = form.id_number.trim();
  // A walk-in has no member record behind them, so the counter needs a name,
  // a reachable number, and a presented ID on every row.
  const canSubmit =
    !submitting &&
    name.length > 0 &&
    mobile.length > 0 &&
    idType.length > 0 &&
    idNumber.length > 0;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const payload = {
        full_name: name,
        mobile_number: mobile,
        id_type: idType,
        id_number: idNumber,
        remarks: form.remarks.trim() || null,
      };
      if (nonMember) {
        await gcashService.updateNonMember(nonMember.id, payload);
        toast.success(`${name} updated.`);
      } else {
        await gcashService.createNonMember(payload);
        toast.success(`${name} added to GCash non-members.`);
      }
      onSaved?.();
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
          <DialogTitle>
            {isEdit ? "Edit Non-Member" : "Add Non-Member"}
          </DialogTitle>
          <DialogDescription>
            A walk-in customer who is not a coop member. Name, mobile number,
            and a presented ID are required — they are the only record you have
            of who transacted.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="nm-name">
              Full Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="nm-name"
              value={form.full_name}
              onChange={(e) => set("full_name", e.target.value)}
              placeholder="Juan Dela Cruz"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="nm-mobile">
              Mobile Number <span className="text-destructive">*</span>
            </Label>
            <Input
              id="nm-mobile"
              inputMode="tel"
              value={form.mobile_number}
              onChange={(e) => set("mobile_number", e.target.value)}
              placeholder="09XXXXXXXXX"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="nm-id-type">
                ID Presented <span className="text-destructive">*</span>
              </Label>
              <Select
                value={form.id_type || undefined}
                onValueChange={(v) => set("id_type", v ?? "")}
              >
                <SelectTrigger id="nm-id-type" className="w-full">
                  <SelectValue placeholder="Select ID" />
                </SelectTrigger>
                <SelectContent>
                  {ID_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nm-id-number">
                ID Number <span className="text-destructive">*</span>
              </Label>
              <Input
                id="nm-id-number"
                value={form.id_number}
                onChange={(e) => set("id_number", e.target.value)}
                placeholder="ID number"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="nm-remarks">Remarks (optional)</Label>
            <Textarea
              id="nm-remarks"
              value={form.remarks}
              onChange={(e) => set("remarks", e.target.value)}
              rows={2}
            />
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
            {submitting ? "Saving…" : isEdit ? "Save Changes" : "Add Non-Member"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
