import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

// Every place Linda appears decides through one gate: the build flag and
// `linda:use` (`lindaAvailable`). Revoking the permission in the role editor
// is the instant off switch, so no entry may check the flag alone.
test("the header trigger and the side panel render only through the Linda gate", () => {
  for (const file of ["src/components/linda/linda-trigger.tsx", "src/components/linda/linda-panel.tsx"]) {
    const text = read(file);
    assert.match(text, /<LindaGate>/, file);
    assert.doesNotMatch(text, /env\.features\.linda/, file);
  }
});

test("the gate checks the build flag before any hook, then linda:use", () => {
  const gate = read("src/components/linda/linda-gate.tsx");
  assert.match(gate, /if \(!env\.features\.linda\) return null;/);
  assert.match(gate, /lindaAvailable\(env\.features\.linda, can\)/);
});

test("the dashboard and the credit scoring card ask the same gate", () => {
  for (const file of [
    "src/app/(app)/dashboard/page.tsx",
    "src/app/(app)/credit-scoring/borrowers/[id]/page.tsx",
  ]) {
    const text = read(file);
    assert.match(text, /useLindaAvailable\(\)/, file);
    assert.doesNotMatch(text, /env\.features\.linda/, file);
  }
});
