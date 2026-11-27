import { test } from "node:test";
import assert from "node:assert/strict";
import type { SavingsAutoCreditInstruction } from "@/types/savings-servicing";
import {
  EMPTY_INSTRUCTION_FORM,
  SCHEDULE_OPTIONS,
  deleteBlocker,
  instructionCreateBody,
  instructionErrors,
  instructionToForm,
  instructionUpdateBody,
  type InstructionForm,
} from "./instruction-form";

const TODAY = "2026-11-12";
const filled: InstructionForm = {
  accountId: "17",
  amount: "500",
  schedule: "15/30",
  authorisedOn: "2026-11-10",
  authorisedBy: "  Payroll officer, DepEd  ",
  remarks: " ",
};

test("the schedules read in the server's words", () => {
  assert.deepEqual(
    SCHEDULE_OPTIONS.map((o) => `${o.value}=${o.label}`),
    ["15=15th", "30=30th (month end)", "15/30=15th and 30th"],
  );
});

test("a new instruction sends the account, the amount as two-decimal text, and starts active", () => {
  assert.deepEqual(instructionErrors(filled, TODAY, true), {});
  assert.deepEqual(instructionCreateBody(filled), {
    account_id: 17,
    amount: "500.00",
    schedule: "15/30",
    authorised_on: "2026-11-10",
    authorised_by: "Payroll officer, DepEd",
    remarks: null,
    active: true,
  });
});

test("an edit never sends the account", () => {
  const body = instructionUpdateBody({ ...filled, remarks: "Raised from ₱300.00" });
  assert.equal("account_id" in body, false);
  assert.equal(body.remarks, "Raised from ₱300.00");
});

test("every missing field is named in words; a future authorisation date is refused", () => {
  const errors = instructionErrors(EMPTY_INSTRUCTION_FORM, TODAY, true);
  assert.deepEqual(Object.keys(errors).sort(), ["accountId", "amount", "authorisedBy", "authorisedOn", "schedule"]);
  assert.equal(
    instructionErrors({ ...filled, authorisedOn: "2026-11-13" }, TODAY, true).authorisedOn,
    "The date it was authorised can't be after today.",
  );
  assert.equal(instructionErrors({ ...filled, accountId: "" }, TODAY, false).accountId, undefined);
});

const instruction = {
  id: 3,
  account_id: 17,
  amount: "500.00",
  schedule: "30",
  authorised_on: "2026-10-01",
  authorised_by: "Member",
  remarks: null,
  last_cycle_date: null,
} as SavingsAutoCreditInstruction;

test("editing refills the form from the server's record", () => {
  assert.deepEqual(instructionToForm(instruction), {
    accountId: "17",
    amount: "500.00",
    schedule: "30",
    authorisedOn: "2026-10-01",
    authorisedBy: "Member",
    remarks: "",
  });
});

test("an instruction that has credited can't be deleted, only deactivated", () => {
  assert.equal(deleteBlocker(instruction), null);
  assert.match(deleteBlocker({ last_cycle_date: "2026-10-31" }) ?? "", /Deactivate it instead/);
});
