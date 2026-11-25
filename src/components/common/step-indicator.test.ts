import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

// Below sm the step labels ran together (five at 390 px), so there the rail is
// numbered dots and the line under it names the step, as the house stepper's
// narrow "Step 2 of 4 · Contact" line does. From sm up nothing changes.
test("the step labels hide below sm, where each page's step line names the step", () => {
  const rail = read("src/components/common/step-indicator.tsx");
  assert.match(rail, /"text-xs font-medium text-center whitespace-nowrap max-sm:hidden"/);
  for (const page of [
    "src/app/(public)/register/page.tsx",
    "src/app/(app)/settings/data-import/_components/data-import-view.tsx",
  ]) {
    const source = read(page);
    assert.match(source, /<StepIndicator /, page);
    assert.match(source, /Step \{[^}]+\} of \{[^}]+\} —/, page);
  }
});
