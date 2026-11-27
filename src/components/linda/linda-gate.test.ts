import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

// Every place Linda appears decides through one gate: the build flag and
// `linda:use` (`lindaAvailable`). Revoking the permission in the role editor
// is the instant off switch, so no entry may check the flag alone.
test("the floating button, the side panel and the expanded chat render only through the Linda gate", () => {
  for (const file of [
    "src/components/linda/linda-fab.tsx",
    "src/components/linda/linda-panel.tsx",
    "src/components/linda/linda-modal.tsx",
  ]) {
    const text = read(file);
    assert.match(text, /<LindaGate>/, file);
    assert.doesNotMatch(text, /env\.features\.linda/, file);
  }
});

test("the gate checks the build flag before any hook, then linda:use", () => {
  const gate = read("src/components/linda/linda-gate.tsx");
  assert.match(gate, /if \(!env\.features\.linda\) return null;/);
  assert.match(gate, /lindaAvailable\(env\.features\.linda, can, isHidden\("linda"\)\)/);
});

// Menu Visibility (finish run round 6): hiding Linda hides her floating
// button, her panel and the expanded chat, all through the one gate.
test("the gate also asks Menu Visibility whether Linda is hidden", () => {
  const gate = read("src/components/linda/linda-gate.tsx");
  assert.match(gate, /useMenuVisibility\(\)/);
});

test("the credit scoring card asks the same gate", () => {
  const file = "src/app/(app)/credit-scoring/borrowers/[id]/page.tsx";
  const text = read(file);
  assert.match(text, /useLindaAvailable\(\)/, file);
  assert.doesNotMatch(text, /env\.features\.linda/, file);
});

// The dashboard's layout follows its own width (a size container) since the
// UI round, so it no longer reads Linda at all; it must never check the flag
// directly, and if it reads Linda again it asks the gate.
test("the dashboard never checks the Linda flag on its own", () => {
  const file = "src/app/(app)/dashboard/page.tsx";
  const text = read(file);
  assert.doesNotMatch(text, /env\.features\.linda/, file);
  if (/useLindaStore|linda/i.test(text)) assert.match(text, /useLindaAvailable\(\)/, file);
});
