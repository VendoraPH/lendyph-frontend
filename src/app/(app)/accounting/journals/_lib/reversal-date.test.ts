import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { formatDate } from "@/lib/format";
import { defaultReversalDate, reversalDateError } from "./reversal-date";

test("a reversal dated before the entry it reverses is refused in words", () => {
  assert.equal(
    reversalDateError("2026-10-01", "2026-10-15"),
    `The reversal date can't be before the entry's own date, ${formatDate("2026-10-15")}.`,
  );
});

test("a reversal on or after the entry's date is accepted", () => {
  assert.equal(reversalDateError("2026-10-15", "2026-10-15"), null);
  assert.equal(reversalDateError("2026-11-09", "2026-10-15"), null);
});

test("an empty date is refused in words", () => {
  assert.equal(reversalDateError("", "2026-10-15"), "Choose the reversal date.");
});

test("the dialog opens on today, or on the entry's date when that is later", () => {
  assert.equal(defaultReversalDate("2026-10-15", "2026-11-09"), "2026-11-09");
  assert.equal(defaultReversalDate("2026-12-01", "2026-11-09"), "2026-12-01");
});

test("the reverse dialog sets the entry's date as its min and shows the refusal", () => {
  const dir = join(process.cwd(), "src/app/(app)/accounting/journals");
  const dialog = readFileSync(join(dir, "_components/reverse-journal-dialog.tsx"), "utf8");
  assert.match(dialog, /min=\{entryDate\}/);
  assert.match(dialog, /reversalDateError\(date, entryDate\)/);
  const page = readFileSync(join(dir, "[id]/page.tsx"), "utf8");
  assert.match(page, /entryDate=\{/);
});
