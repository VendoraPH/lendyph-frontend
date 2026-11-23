import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const dialog = readFileSync(join(process.cwd(), "src/components/common/reason-dialog.tsx"), "utf8");

// A void reason or an adjustment remark may run to the 1,000 characters the
// server keeps; the branch actions keep their 500.
test("the reason may be as long as its endpoint keeps, 500 unless the caller says otherwise", () => {
  assert.match(dialog, /maxLength = REASON_MAX_LENGTH,/);
  assert.match(dialog, /<Textarea[\s\S]*?maxLength=\{maxLength\}/);
  assert.doesNotMatch(dialog, /maxLength=\{REASON_MAX_LENGTH\}/);
});
