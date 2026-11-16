/**
 * The illustration slots the empty, error and sign-in screens read.
 *
 * WHAT THIS PROVES: every slot the screens ask for is in the map, nothing else
 * is, each value is either null (the screen renders as it always has) or a
 * path under /illustrations/ that the app serves itself, and every slot ships
 * empty until the pictures are added.
 * WHAT IT DOES NOT PROVE: how a screen draws the picture (browser check).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { ILLUSTRATION_NAMES, ILLUSTRATIONS, illustrationSrc } from "./illustrations";

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

test("every slot is empty until the pictures are added", () => {
  for (const name of EXPECTED) {
    assert.equal(illustrationSrc(name as (typeof ILLUSTRATION_NAMES)[number]), null, name);
  }
});
