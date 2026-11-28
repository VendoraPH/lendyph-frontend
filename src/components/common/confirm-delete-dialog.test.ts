import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const dialog = readFileSync(join(process.cwd(), "src/components/common/confirm-delete-dialog.tsx"), "utf8");

// Clearing a CIC product mapping reads "Clear mapping"; every other caller
// passes no label and keeps "Delete".
test("the confirm button reads Delete unless the caller names the action", () => {
  assert.match(dialog, /confirmLabel = "Delete",/);
  assert.match(dialog, /<AlertDialogAction[\s\S]*?\{confirmLabel\}\s*<\/AlertDialogAction>/);
  assert.doesNotMatch(dialog, /\n\s*Delete\n\s*<\/AlertDialogAction>/);
});
