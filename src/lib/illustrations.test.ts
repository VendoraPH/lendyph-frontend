/**
 * The illustration slots the empty, error and sign-in screens read.
 *
 * WHAT THIS PROVES: every slot the screens ask for is in the map, nothing else
 * is, each value is either null (the screen renders as it always has) or a
 * path under /illustrations/ that the app serves itself, every filled slot's
 * file is really in public/, and only the object pictures (white backgrounds)
 * get the dark-mode tile.
 * WHAT IT DOES NOT PROVE: how a screen draws the picture (browser check).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { ILLUSTRATION_NAMES, ILLUSTRATIONS, ON_WHITE } from "./illustrations";

const EXPECTED = [
  "signIn",
  "portalSignIn",
  "empty",
  "noResults",
  "allCaughtUp",
  "error",
  "notConnected",
  "noAccess",
  "notFound",
  "pickReport",
];

test("the map holds exactly the named slots", () => {
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

test("only the object pictures get the dark-mode tile; the sign-in scenes don't", () => {
  assert.equal(ON_WHITE.has("signIn"), false);
  assert.equal(ON_WHITE.has("portalSignIn"), false);
  for (const name of ["empty", "noResults", "allCaughtUp", "error", "notConnected", "noAccess", "notFound", "pickReport"] as const) {
    assert.equal(ON_WHITE.has(name), true, name);
  }
});
