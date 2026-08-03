import { test } from "node:test";
import assert from "node:assert/strict";
import { withVersion } from "./file-url";

test("withVersion leaves the URL untouched at version 0 so first paint stays cacheable", () => {
  assert.equal(withVersion("/storage/logo.png", 0), "/storage/logo.png");
});

test("withVersion appends v with ? when the URL has no query string", () => {
  assert.equal(withVersion("/storage/logo.png", 1), "/storage/logo.png?v=1");
});

test("withVersion appends v with & when the URL already has a query string", () => {
  assert.equal(
    withVersion("https://cdn.test/logo.png?w=200", 3),
    "https://cdn.test/logo.png?w=200&v=3"
  );
});

// The whole point of the version: a replaced logo can come back on the exact
// same storage path, so the URL alone cannot tell the browser to refetch.
test("withVersion distinguishes successive uploads that reuse one storage path", () => {
  const path = "/storage/branding/logo.png";
  assert.notEqual(withVersion(path, 1), withVersion(path, 2));
});

test("withVersion returns an empty string unchanged", () => {
  assert.equal(withVersion("", 5), "");
});
