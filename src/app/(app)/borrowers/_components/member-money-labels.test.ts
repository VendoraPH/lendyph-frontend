import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Money is ₱ on screen. "PHP" stays only in SMS text, never in a form label.
const forms: [path: string, label: string][] = [
  ["src/app/(app)/borrowers/new/page.tsx", "Monthly Income (₱)"],
  ["src/app/(app)/borrowers/[id]/edit/page.tsx", "Monthly Income (₱)"],
  ["src/app/(app)/borrowers/[id]/_components/co-maker-form-fields.tsx", "Monthly Income (₱)"],
  ["src/app/(public)/register/_components/step-employment.tsx", "Monthly Income (₱)"],
  ["src/app/(app)/loans/amortization/page.tsx", "Principal Amount (₱)"],
];

for (const [path, label] of forms) {
  test(`${path} labels money in ₱, never (PHP)`, () => {
    const source = readFileSync(join(process.cwd(), path), "utf8");
    assert.ok(!source.includes("(PHP)"), path);
    assert.ok(source.includes(label), path);
  });
}
