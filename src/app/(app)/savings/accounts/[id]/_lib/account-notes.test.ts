import { test } from "node:test";
import assert from "node:assert/strict";
import { NOTE_MAX_LENGTH, NOTE_PRIVACY_HINT, checkNote, noteLengthText } from "./account-notes";

test("a note is sent trimmed, as the server stores it", () => {
  assert.deepEqual(checkNote("  Member called about the dormancy notice.  "), {
    ok: true,
    note: "Member called about the dormancy notice.",
  });
});

test("a blank note or one over 1,000 characters is refused in words", () => {
  assert.deepEqual(checkNote("   "), { ok: false, message: "Write the note." });
  assert.deepEqual(checkNote("x".repeat(NOTE_MAX_LENGTH + 1)), {
    ok: false,
    message: "A note can be at most 1,000 characters.",
  });
  assert.equal(checkNote("x".repeat(NOTE_MAX_LENGTH)).ok, true);
});

test("the hint warns that notes are permanent and hold no ID numbers or contact details", () => {
  assert.match(NOTE_PRIVACY_HINT, /permanent/);
  assert.match(NOTE_PRIVACY_HINT, /ID numbers/);
  assert.match(NOTE_PRIVACY_HINT, /contact numbers/);
});

test("the counter reads the trimmed length out of 1,000", () => {
  assert.equal(noteLengthText("  abc "), "3 / 1,000");
});
