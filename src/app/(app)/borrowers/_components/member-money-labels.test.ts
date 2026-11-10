import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Money is ₱ on screen. "PHP" stays only in SMS text, never in a form label.
const forms = [
  "src/app/(app)/borrowers/new/page.tsx",
  "src/app/(app)/borrowers/[id]/edit/page.tsx",
  "src/app/(app)/borrowers/[id]/_components/co-maker-form-fields.tsx",
  "src/app/(public)/register/_components/step-employment.tsx",
];

for (const path of forms) {
  test(`${path} labels money in ₱, never (PHP)`, () => {
    const source = readFileSync(join(process.cwd(), path), "utf8");
    assert.ok(!source.includes("(PHP)"), path);
    assert.ok(source.includes("Monthly Income (₱)"), path);
  });
}
