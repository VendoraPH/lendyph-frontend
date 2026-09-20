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

test("a user still on the OLD single-branch shape is read, not ignored", () => {
  // `api.get<User>()` is an unchecked cast, so during the rollout this dialog
  // is opened on users that carry `branch` and no `branches` at all. Reading
  // `user.branches` directly would be `undefined` here — a crash before this
  // fix, and an empty list after it, which would report a branch change on a
  // form nobody touched and fire a pointless PUT.
  const legacy = { ...user, branches: undefined, branch: { id: 3, name: "Main" } } as unknown as User;
  assert.deepEqual(userEditChanges(legacy, untouched), []);
});

test("editing a user on the old shape still detects a real branch change", () => {
  const legacy = { ...user, branches: undefined, branch: { id: 3, name: "Main" } } as unknown as User;
  const changed = userEditChanges(legacy, { ...untouched, branch_ids: [3, 9] });
  assert.deepEqual(changed, ["branch_ids"]);
});

test("a user carrying no branch assignment in either shape is branchless", () => {
  const neither = { ...user, branches: undefined } as unknown as User;
  assert.deepEqual(userEditChanges(neither, { ...untouched, branch_ids: [] }), []);
  assert.deepEqual(userEditChanges(neither, untouched), ["branch_ids"]);
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
  //
  // `branch_id` is the one key here the change check does not compare by name,
  // and it is allowed in on one condition, asserted directly below: it is a
  // pure function of `branch_ids` AS A SET, which the check does compare. It
  // exists so this request lands whether the frontend or the backend half of
  // multi-branch merges first.
  assert.deepEqual(Object.keys(userEditPayload(untouched)).sort(), [
    "branch_id",
    "branch_ids",
    "email",
    "first_name",
    "last_name",
    "mobile_number",
    "role",
  ]);
});

test("the compatibility branch_id cannot move while the change check says nothing changed", () => {
  // The condition that lets `branch_id` sit in the payload without being
  // compared: for any two selections the check calls identical, the derived
  // key is identical too.
  const a = { ...untouched, branch_ids: [3, 9] };
  const b = { ...untouched, branch_ids: [9, 3] };
  const multi = { ...user, branches: [{ id: 3, name: "Main" }, { id: 9, name: "North" }] } as User;

  assert.deepEqual(userEditChanges(multi, a), []);
  assert.deepEqual(userEditChanges(multi, b), []);
  assert.equal(userEditPayload(a).branch_id, userEditPayload(b).branch_id);
});

test("the payload sends both branch shapes, so either merge order works", () => {
  const payload = userEditPayload({ ...untouched, branch_ids: [9, 3] });
  assert.deepEqual(payload.branch_ids, [9, 3]);
  assert.equal(payload.branch_id, 3);
});
