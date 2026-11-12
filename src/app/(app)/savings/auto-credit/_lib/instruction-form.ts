import { parseMoneyInput } from "@/lib/money-input";
import type {
  AutoCreditSchedule,
  SavingsAutoCreditInstruction,
  SavingsAutoCreditInstructionInput,
  SavingsAutoCreditInstructionUpdate,
} from "@/types/savings-servicing";

/** The schedules in the server's words (`schedule_label`). */
export const SCHEDULE_OPTIONS: ReadonlyArray<{ value: AutoCreditSchedule; label: string }> = [
  { value: "15", label: "15th" },
  { value: "30", label: "30th (month end)" },
  { value: "15/30", label: "15th and 30th" },
];

export interface InstructionForm {
  accountId: string;
  amount: string;
  schedule: AutoCreditSchedule | "";
  authorisedOn: string;
  authorisedBy: string;
  remarks: string;
}

export const EMPTY_INSTRUCTION_FORM: InstructionForm = {
  accountId: "",
  amount: "",
  schedule: "",
  authorisedOn: "",
  authorisedBy: "",
  remarks: "",
};

/** The form refilled from an instruction, to edit it. */
export function instructionToForm(i: SavingsAutoCreditInstruction): InstructionForm {
  return {
    accountId: String(i.account_id),
    amount: i.amount,
    schedule: i.schedule,
    authorisedOn: i.authorised_on ?? "",
    authorisedBy: i.authorised_by ?? "",
    remarks: i.remarks ?? "",
  };
}

export type InstructionErrors = Partial<Record<keyof InstructionForm, string>>;

/** Each field's problem in words; the server checks them again (422 in words). */
export function instructionErrors(form: InstructionForm, today: string, creating: boolean): InstructionErrors {
  const errors: InstructionErrors = {};
  if (creating && !form.accountId) errors.accountId = "Choose the savings account.";
  const amount = parseMoneyInput(form.amount, { label: "The amount" });
  if (!amount.ok) errors.amount = amount.message;
  if (!form.schedule) errors.schedule = "Choose the 15th, the 30th (month end) or both.";
  if (!form.authorisedOn) errors.authorisedOn = "Enter the date the member authorised it.";
  else if (form.authorisedOn > today) errors.authorisedOn = "The date it was authorised can't be after today.";
  const by = form.authorisedBy.trim();
  if (!by) errors.authorisedBy = "Enter who authorised the instruction.";
  else if (by.length > 120) errors.authorisedBy = "Who authorised it can be at most 120 characters.";
  if (form.remarks.trim().length > 500) errors.remarks = "The remarks can be at most 500 characters.";
  return errors;
}

function common(form: InstructionForm) {
  const amount = parseMoneyInput(form.amount);
  return {
    amount: amount.ok ? amount.value : form.amount.trim(),
    schedule: form.schedule as AutoCreditSchedule,
    authorised_on: form.authorisedOn,
    authorised_by: form.authorisedBy.trim(),
    remarks: form.remarks.trim() || null,
  };
}

/** `POST` body: a new instruction starts active. */
export function instructionCreateBody(form: InstructionForm): SavingsAutoCreditInstructionInput {
  return { account_id: Number(form.accountId), ...common(form), active: true };
}

/** `PUT` body: every field but the account, which never changes. */
export function instructionUpdateBody(form: InstructionForm): SavingsAutoCreditInstructionUpdate {
  return common(form);
}

/** Why an instruction can't be deleted, or null. One that has credited is kept for the record. */
export function deleteBlocker(i: Pick<SavingsAutoCreditInstruction, "last_cycle_date">): string | null {
  return i.last_cycle_date
    ? "It has credited the account, so it is kept for the record. Deactivate it instead."
    : null;
}
