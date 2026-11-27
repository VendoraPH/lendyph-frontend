import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const picker = readFileSync(
  join(process.cwd(), "src/app/(app)/gcash/_components/gcash-party-picker.tsx"),
  "utf8",
);

test("every way the list closes clears the search, picking a row included", () => {
  // A pick used to close the list with setOpen(false), which skips
  // onOpenChange and its reset, so the next opening searched the old text
  // with the new keystrokes added to it.
  assert.doesNotMatch(picker, /setOpen\(false\)/);
  assert.match(picker, /onSelect=\{\(\) => \{\s*onChange\([^)]*\);\s*changeOpen\(false\);/);
});
