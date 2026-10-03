import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { memberPicker } from "./member-picker";

describe("memberPicker", () => {
  test("a new application picks its member", () => {
    assert.deepEqual(memberPicker(false, null, null), { locked: false, label: null });
    assert.deepEqual(memberPicker(false, "Juan Dela Cruz", null), { locked: false, label: "Juan Dela Cruz" });
  });

  test("an edit locks the picker on the loan's member", () => {
    assert.deepEqual(memberPicker(true, "Juan Dela Cruz", "Juan Dela Cruz"), {
      locked: true,
      label: "Juan Dela Cruz",
    });
  });

  test("an edit still names the member when the member list doesn't have them", () => {
    assert.deepEqual(memberPicker(true, null, "Maria Santos"), { locked: true, label: "Maria Santos" });
  });

  test("an edit stays locked even with no name to show", () => {
    assert.equal(memberPicker(true, null, null).locked, true);
  });
});
