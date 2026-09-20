import test from "node:test";
import assert from "node:assert/strict";

import { userEditChanges, userEditPayload, type UserEditForm } from "./user-edit";
import type { User } from "@/types";

const user = {
  id: 7,
  first_name: "Juan",
  last_name: "Dela Cruz",
  full_name: "Juan Dela Cruz",
  username: "jdelacruz",
  email: "juan@coop.ph",
  mobile_number: "09171234567",
  status: "active",
  branches: [{ id: 3, name: "Main" }],
  roles: ["loan_officer"],
  permissions: [],
} as unknown as User;

const untouched: UserEditForm = {
  first_name: "Juan",
  last_name: "Dela Cruz",
  email: "juan@coop.ph",
  mobile_number: "09171234567",
  role: "loan_officer",
  branch_ids: [3],
};

test("a form nobody touched reports no changes", () => {
  assert.deepEqual(userEditChanges(user, untouched), []);
});

test("each editable field is detected on its own", () => {
  const cases: [keyof UserEditForm, string | number | number[], string][] = [
    ["first_name", "Juanito", "first_name"],
    ["last_name", "Santos", "last_name"],
    ["email", "other@coop.ph", "email"],
    ["mobile_number", "09991112222", "mobile_number"],
    ["role", "cashier", "role"],
    ["branch_ids", [9], "branch_ids"],
  ];

  for (const [field, value, expected] of cases) {
    const changed = userEditChanges(user, { ...untouched, [field]: value });
    assert.deepEqual(changed, [expected], `${field} should be the only change`);
  }
});

test("several edits at once are all reported", () => {
  const changed = userEditChanges(user, {
    ...untouched,
    first_name: "Juanito",
    role: "cashier",
  });
  assert.deepEqual(changed, ["first_name", "role"]);
});

test("an account with no branches is unchanged while the form leaves it empty", () => {
  const branchless = { ...user, branches: [] } as User;
  const changed = userEditChanges(branchless, { ...untouched, branch_ids: [] });
  assert.deepEqual(changed, []);
});

test("giving a branchless account a branch is a change", () => {
  const branchless = { ...user, branches: [] } as User;
  const changed = userEditChanges(branchless, { ...untouched, branch_ids: [3] });
  assert.deepEqual(changed, ["branch_ids"]);
});

test("reordering the same set of branches is not a change", () => {
  const multiBranch = { ...user, branches: [{ id: 3, name: "Main" }, { id: 9, name: "North" }] } as User;
  const changed = userEditChanges(multiBranch, { ...untouched, branch_ids: [9, 3] });
  assert.deepEqual(changed, []);
});

test("adding a second branch to a single-branch account is a change", () => {
  const changed = userEditChanges(user, { ...untouched, branch_ids: [3, 9] });
  assert.deepEqual(changed, ["branch_ids"]);
});

test("an account with no mobile number is unchanged while the field stays empty", () => {
  const noMobile = { ...user, mobile_number: null } as User;
  const changed = userEditChanges(noMobile, { ...untouched, mobile_number: "" });
  assert.deepEqual(changed, []);
});

test("adding a mobile number to an account that had none is a change", () => {
  const noMobile = { ...user, mobile_number: null } as User;
  const changed = userEditChanges(noMobile, { ...untouched, mobile_number: "09991112222" });
  assert.deepEqual(changed, ["mobile_number"]);
});

test("clearing a mobile number reads as no change, because the payload omits it", () => {
  // Not a quirk of this helper — `userEditPayload` collapses "" to undefined, so
  // the key never reaches the server and the column is never written. Saying
  // "no changes" is the honest answer; answering "User updated" was the lie.
  // Clearing the field needs the payload to send null, which is a backend
  // contract change.
  const form = { ...untouched, mobile_number: "" };
  assert.equal(userEditPayload(form).mobile_number, undefined);
  assert.deepEqual(userEditChanges(user, form), []);
});

test("the payload carries exactly the fields the change check compares", () => {
  // If these ever diverge, the dialog would ask "did anything change?" of a
  // different object than the one it sends, and the server's 422 would come
  // back as a surprise.
  assert.deepEqual(Object.keys(userEditPayload(untouched)).sort(), [
    "branch_ids",
    "email",
    "first_name",
    "last_name",
    "mobile_number",
    "role",
  ]);
});
