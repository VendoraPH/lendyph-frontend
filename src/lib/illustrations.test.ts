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
import { ILLUSTRATION_NAMES, ILLUSTRATIONS, illustrationTileClass } from "./illustrations";

const EXPECTED = ["empty", "noResults", "allCaughtUp", "error", "notConnected", "noAccess", "notFound", "pickReport"];

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

test("every picture sits on a rounded white tile in both modes, so its white corners never show", () => {
  const classes = illustrationTileClass().split(/\s+/);
  for (const t of ["rounded-2xl", "bg-white", "p-1.5"]) assert.ok(classes.includes(t), t);
  assert.ok(!classes.some((c) => c.startsWith("dark:")), "the tile isn't dark-mode only");
});
