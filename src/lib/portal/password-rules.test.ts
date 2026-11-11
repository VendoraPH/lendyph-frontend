import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_PASSWORD_RULES, passwordHints, passwordReady } from "./password-rules";

test("the checklist follows the server's rule", () => {
  const hints = passwordHints("abc", DEFAULT_PASSWORD_RULES);
  assert.deepEqual(
    hints.map((h) => [h.text, h.met]),
    [
      ["10 to 128 characters", false],
      ["At least one letter", true],
      ["At least one number", false],
      ["Doesn't contain your member number", null],
    ],
  );
});

test("ready once the browser's checks pass and both entries match; the server decides the rest", () => {
  assert.equal(passwordReady("sunrise2026x", "sunrise2026x"), true);
  assert.equal(passwordReady("sunrise2026x", "sunrise2026y"), false);
  assert.equal(passwordReady("sunriseeeee", "sunriseeeee"), false);
  assert.equal(passwordReady("short1", "short1", { ...DEFAULT_PASSWORD_RULES, min_length: 6 }), true);
});
