import { test } from "node:test";
import assert from "node:assert/strict";
import { closeAllowed, createCodeAttempts } from "./code-attempts";

// A code is shown once. If the dialog closed while the server was issuing
// it, the code would land in a closed dialog: staff never see it, and the
// member's earlier code is already replaced.
test("the code dialog can't be closed while a code is being issued", () => {
  assert.equal(closeAllowed(false, true), false);
  assert.equal(closeAllowed(false, false), true);
  assert.equal(closeAllowed(true, true), true);
});

test("a code that arrives for the attempt in progress is shown", () => {
  const attempts = createCodeAttempts();
  const id = attempts.begin();
  assert.equal(attempts.isCurrent(id), true);
});

test("a code that arrives after the dialog closed, or after a newer attempt, is dropped", () => {
  const attempts = createCodeAttempts();
  const first = attempts.begin();
  attempts.cancel();
  assert.equal(attempts.isCurrent(first), false);
  const second = attempts.begin();
  const third = attempts.begin();
  assert.equal(attempts.isCurrent(second), false);
  assert.equal(attempts.isCurrent(third), true);
});
