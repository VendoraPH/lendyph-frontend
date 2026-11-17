/**
 * The illustration slots the empty, error and no-access screens read.
 *
 * WHAT THIS PROVES: every slot the screens ask for is in the map, nothing else
 * is, each value is either null (the screen renders as it always has) or a
 * path under /illustrations/ that the app serves itself, every filled slot's
 * file is really in public/, and every picture sits on the rounded white tile
 * in light and dark mode alike. The sign-in pages have no pictures (Arvin,
 * 2026-11-17: the login page stays as it is).
 * WHAT IT DOES NOT PROVE: how a screen draws the picture (browser check).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  ILLUSTRATION_NAMES,
  ILLUSTRATIONS,
  MODULE_ILLUSTRATION_NAMES,
  emptyArt,
  filtersActive,
  illustrationTileClass,
} from "./illustrations";

const MODULES = [
  "emptyLoans",
  "emptyMembers",
  "emptyPayments",
  "emptySavings",
  "emptyShareCapital",
  "emptyCollaterals",
  "emptyWallet",
  "emptyLedger",
  "emptyCompliance",
  "emptyReminders",
  "emptyDocuments",
];

const EXPECTED = [
  "empty",
  "noResults",
  "allCaughtUp",
  "error",
  "notConnected",
  "noAccess",
  "notFound",
  "pickReport",
  ...MODULES,
  "portalWelcome",
];

/** emptyShareCapital -> empty-share-capital */
const kebab = (name: string) => name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

test("the map holds exactly the named slots, and none for the sign-in pages", () => {
  assert.deepEqual([...ILLUSTRATION_NAMES].sort(), [...EXPECTED].sort());
  assert.deepEqual(Object.keys(ILLUSTRATIONS).sort(), [...EXPECTED].sort());
});

test("a filled slot is a local path under /illustrations/", () => {
  for (const name of ILLUSTRATION_NAMES) {
    const src = ILLUSTRATIONS[name];
    if (src === null) continue;
    assert.match(src, /^\/illustrations\/[a-z0-9-]+\.(webp|png|svg)$/, name);
  }
});

test("every filled slot's picture is in public/", () => {
  for (const name of ILLUSTRATION_NAMES) {
    const src = ILLUSTRATIONS[name];
    if (src === null) continue;
    assert.ok(existsSync(join(process.cwd(), "public", src)), `${name}: public${src} is missing`);
  }
});

test("the module pictures are exactly the eleven module slots", () => {
  assert.deepEqual([...MODULE_ILLUSTRATION_NAMES].sort(), [...MODULES].sort());
});

test("the module pictures and the portal welcome are filled, each under its own kebab-case file name", () => {
  for (const name of [...MODULES, "portalWelcome"] as const) {
    const src = ILLUSTRATIONS[name as keyof typeof ILLUSTRATIONS];
    assert.equal(src, `/illustrations/${kebab(name)}.webp`, name);
  }
});

test("an empty list shows its module's picture, and a search or filter that matched nothing shows noResults", () => {
  for (const name of MODULE_ILLUSTRATION_NAMES) {
    assert.equal(emptyArt(name, false), name);
    assert.equal(emptyArt(name, true), "noResults");
  }
});

test("a filter object counts as filtered only when a key other than paging holds a value", () => {
  assert.equal(filtersActive({ page: 1, per_page: 20 }), false);
  assert.equal(filtersActive({ page: 3, per_page: 50, status: undefined, date_from: "", loan_id: null }), false);
  assert.equal(filtersActive({ page: 1, per_page: 20, status: "sent" }), true);
  assert.equal(filtersActive({ page: 1, branch_id: 4 }), true);
  assert.equal(filtersActive({ page: 1, date_to: "2026-11-17" }), true);
});

test("every picture sits on a rounded white tile in both modes, so its white corners never show", () => {
  const classes = illustrationTileClass().split(/\s+/);
  for (const t of ["rounded-2xl", "bg-white", "p-1.5"]) assert.ok(classes.includes(t), t);
  assert.ok(!classes.some((c) => c.startsWith("dark:")), "the tile isn't dark-mode only");
});
