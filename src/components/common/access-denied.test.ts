import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const page = readFileSync(join(process.cwd(), "src/components/common/access-denied.tsx"), "utf8");

// The dashboard route sends a user without dashboard:view on to the first page
// the menu offers them, so the button names where it really goes.
test("Access Restricted's button goes to the home page and says so", () => {
  assert.match(page, /onClick=\{\(\) => router\.push\("\/dashboard"\)\}\s*>\s*Go to home page\s*</);
  assert.doesNotMatch(page, /Go to Dashboard/);
});

// The not-found page's staff button takes the same route, so it reads the same.
test("the not-found page's staff button says home page too", () => {
  const notFound = readFileSync(join(process.cwd(), "src/app/not-found.tsx"), "utf8");
  assert.match(notFound, /"Go to home page"/);
  assert.doesNotMatch(notFound, /Go to Dashboard/);
});
