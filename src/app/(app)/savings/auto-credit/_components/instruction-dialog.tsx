"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useDialogOpening } from "@/hooks";
import { useSubmitGuard } from "@/hooks/use-submit-guard";
import { todayISO } from "@/lib/format";
import { notifyError, notifySuccess } from "@/lib/notify";
import { savingsAutoCreditService } from "@/services";
import type { SavingsAutoCreditInstruction } from "@/types/savings-servicing";
import { FormField } from "../../_components/field";
import { OptionSelect } from "../../_components/option-select";
import {
  EMPTY_INSTRUCTION_FORM,
  SCHEDULE_OPTIONS,
  instructionCreateBody,
  instructionErrors,
  instructionToForm,
  instructionUpdateBody,
  type InstructionForm,
} from "../_lib/instruction-form";
import { AccountPicker } from "./account-picker";

interface InstructionDialogProps {
  open: boolean;
  /** The instruction being edited, or null to add one. */
  instruction: SavingsAutoCreditInstruction | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

/** Add or edit a member's standing auto-credit instruction. The account never changes once saved. */
export function InstructionDialog({ open, instruction, onOpenChange, onSaved }: InstructionDialogProps) {
  const creating = instruction === null;
  const [form, setForm] = useState<InstructionForm>(EMPTY_INSTRUCTION_FORM);
  const [submitted, setSubmitted] = useState(false);
  const { submitting, run } = useSubmitGuard();
  if (useDialogOpening(open, instruction?.id ?? "new")) {
    setForm(instruction ? instructionToForm(instruction) : { ...EMPTY_INSTRUCTION_FORM, authorisedOn: todayISO() });
    setSubmitted(false);
  }

  const today = todayISO();
  const errors = instructionErrors(form, today, creating);
  const show = (key: keyof InstructionForm) => (submitted ? (errors[key] ?? null) : null);
  const set = (patch: Partial<InstructionForm>) => setForm((f) => ({ ...f, ...patch }));

  function save() {
    setSubmitted(true);
    if (Object.keys(errors).length > 0) return;
    run(() =>
      instruction
        ? savingsAutoCreditService.update(instruction.id, instructionUpdateBody(form))
        : savingsAutoCreditService.create(instructionCreateBody(form)),
    )
      ?.then((saved) => {
        notifySuccess(creating ? "Instruction added" : "Instruction saved", `${saved.account_number ?? ""} · ${saved.schedule_label}`);
        onOpenChange(false);
        onSaved();
      })
      .catch((err: unknown) => notifyError(err, "Couldn't save the instruction."));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{creating ? "Add auto-credit instruction" : "Edit auto-credit instruction"}</DialogTitle>
          <DialogDescription>
            {instruction
              ? `${instruction.account_number ?? ""} · ${instruction.borrower_name ?? "Member"}. The account can't be changed; make a new instruction for another account.`
              : "A fixed amount credited to the member's savings on the 15th, the 30th (month end), or both, as the member authorised."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {creating && (
            <FormField id="ins-account" label="Savings account" error={show("accountId")}>
              <AccountPicker id="ins-account" value={form.accountId} onChange={(accountId) => set({ accountId })} />
            </FormField>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="ins-amount" label="Amount each cycle" error={show("amount")}>
              <Input
                id="ins-amount"
                inputMode="decimal"
                placeholder="0.00"
                value={form.amount}
                onChange={(e) => set({ amount: e.target.value })}
              />
            </FormField>
            <FormField id="ins-schedule" label="Schedule" error={show("schedule")}>
              <OptionSelect
                id="ins-schedule"
                value={form.schedule}
                onChange={(v) => set({ schedule: v as InstructionForm["schedule"] })}
                options={SCHEDULE_OPTIONS}
                placeholder="Choose the cycle"
              />
            </FormField>
            <FormField id="ins-on" label="Authorised on" error={show("authorisedOn")}>
              <Input
                id="ins-on"
                type="date"
                max={today}
                value={form.authorisedOn}
                onChange={(e) => set({ authorisedOn: e.target.value })}
              />
            </FormField>
            <FormField
              id="ins-by"
              label="Authorised by"
              error={show("authorisedBy")}
              hint="The member, or the payroll officer who signed."
            >
              <Input
                id="ins-by"
                maxLength={120}
                value={form.authorisedBy}
                onChange={(e) => set({ authorisedBy: e.target.value })}
              />
            </FormField>
          </div>
          <FormField id="ins-remarks" label="Remarks (optional)" error={show("remarks")}>
            <Textarea
              id="ins-remarks"
              rows={2}
              maxLength={500}
              value={form.remarks}
              onChange={(e) => set({ remarks: e.target.value })}
            />
          </FormField>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={save} disabled={submitting}>
            {submitting ? "Saving…" : creating ? "Add instruction" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
