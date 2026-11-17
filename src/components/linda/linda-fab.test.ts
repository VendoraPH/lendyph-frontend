import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { isLindaPage, lindaAvailable, lindaFabVisible } from "@/lib/linda";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const holds = (...held: string[]) => (p: string) => held.includes(p);
const shown = {
  available: lindaAvailable(true, holds("linda:use")),
  pathname: "/dashboard",
  open: false,
  expanded: false,
};

test("the floating button shows on every page for a user who may ask Linda", () => {
  assert.equal(lindaFabVisible(shown), true);
  assert.equal(lindaFabVisible({ ...shown, pathname: "/loans/12" }), true);
});

test("the floating button needs the build flag and linda:use", () => {
  assert.equal(lindaFabVisible({ ...shown, available: lindaAvailable(false, holds("linda:use")) }), false);
  assert.equal(lindaFabVisible({ ...shown, available: lindaAvailable(true, holds()) }), false);
  assert.equal(lindaFabVisible({ ...shown, available: lindaAvailable(true, holds("linda:settings")) }), false);
});

test("the floating button hides on /linda, which is Linda already", () => {
  assert.equal(lindaFabVisible({ ...shown, pathname: "/linda" }), false);
  assert.equal(lindaFabVisible({ ...shown, pathname: "/linda/" }), false);
  assert.equal(lindaFabVisible({ ...shown, pathname: "/settings/linda" }), true);
  assert.equal(lindaFabVisible({ ...shown, pathname: "/lindafoo" }), true);
  assert.equal(isLindaPage(null), false);
});

test("the floating button hides while the panel or the expanded chat is open", () => {
  assert.equal(lindaFabVisible({ ...shown, open: true }), false);
  assert.equal(lindaFabVisible({ ...shown, expanded: true }), false);
});

test("the header button is gone: the floating button replaces it", () => {
  assert.equal(existsSync(resolve(process.cwd(), "src/components/linda/linda-trigger.tsx")), false);
  const header = read("src/components/layout/header.tsx");
  assert.doesNotMatch(header, /LindaTrigger|linda-trigger/);
});

test("the floating button is mounted in the app shell beside the panel, inside the Linda gate", () => {
  const layout = read("src/app/(app)/layout.tsx");
  assert.match(layout, /<LindaPanel \/>/);
  assert.match(layout, /<LindaFab \/>/);
  const fab = read("src/components/linda/linda-fab.tsx");
  assert.match(fab, /<LindaGate>/);
  assert.doesNotMatch(fab, /env\.features\.linda/);
  assert.match(fab, /lindaFabVisible\(/);
  assert.match(fab, /useLindaAvailable\(\)/);
  // FE-S's clearance hook: pinned controls keep clear of the button while it shows.
  assert.match(fab, /data-linda-fab/);
  assert.match(fab, /\[data-app-shell\]/);
  assert.match(fab, /aria-label="Ask Linda"/);
  assert.match(fab, /\/linda\/linda-face-128\.webp/);
});

test("focus returns to the floating button when Linda closes", () => {
  const focus = read("src/components/linda/use-linda-panel-focus.ts");
  assert.match(focus, /LINDA_FAB_ID = "linda-fab"/);
  assert.doesNotMatch(focus, /linda-trigger/);
  assert.match(read("src/components/linda/linda-fab.tsx"), /id=\{LINDA_FAB_ID\}/);
});

test("Linda shows her own face, never the old sparkle mark", () => {
  assert.equal(existsSync(resolve(process.cwd(), "src/components/linda/linda-mark.tsx")), false);
  const avatar = read("src/components/linda/linda-avatar.tsx");
  assert.match(avatar, /\/linda\/linda-face-64\.webp/);
  assert.match(avatar, /alt=/);
});

test("the panel can open the same conversation in a large dialog", () => {
  const panel = read("src/components/linda/linda-panel.tsx");
  assert.match(panel, /aria-label="Expand chat"/);
  assert.match(panel, /Maximize2/);
  const modal = read("src/components/linda/linda-modal.tsx");
  assert.match(modal, /size="full"/);
  assert.match(modal, /max-w-\[960px\]/);
  assert.match(modal, /85dvh/);
  assert.match(modal, /<LindaGate>|LindaGate/);
});
