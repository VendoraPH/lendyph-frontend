import { test } from "node:test";
import assert from "node:assert/strict";
import { roleConflictMessage } from "./role-conflict";

const conflict = (data: unknown) => ({ response: { status: 409, data } });

test("a 409 shows the server's sentence", () => {
  assert.equal(
    roleConflictMessage(conflict({ message: "This role was changed or deleted by another request. Reload and try again." })),
    "This role was changed or deleted by another request. Reload and try again.",
  );
});

test("a 409 without a readable message gets the role wording, not the generic conflict copy", () => {
  const expected = "This role was changed or deleted by another request. Reload and try again.";
  assert.equal(roleConflictMessage(conflict({})), expected);
  assert.equal(roleConflictMessage(conflict({ message: "role_conflict" })), expected);
});

test("other statuses and non-HTTP errors are left to their own handling", () => {
  assert.equal(roleConflictMessage({ response: { status: 422, data: { message: "Taken." } } }), null);
  assert.equal(roleConflictMessage(new Error("boom")), null);
  assert.equal(roleConflictMessage(undefined), null);
});
