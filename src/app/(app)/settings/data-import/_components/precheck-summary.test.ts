import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function component(file: string): string {
  return readFileSync(join(process.cwd(), "src/app/(app)/settings/data-import/_components", file), "utf8");
}

/**
 * A warning is not always a repair or a match: since finish run round 3 a
 * blank birthdate is one too, and the member is imported without it. So the
 * Check step says each note tells what the import does, and nothing on it
 * says every warning is a repair.
 */
test("the warnings banner says each note tells what the import does with the value", () => {
  assert.match(component("precheck-summary.tsx"), /"These rows import\. Each note says what the import does with the value\."/);

  for (const file of ["precheck-summary.tsx", "precheck-errors-table.tsx", "step-check.tsx"]) {
    assert.doesNotMatch(component(file), /repairs or matches|the note is so you know what it did/, file);
  }
});
