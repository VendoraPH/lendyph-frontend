import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { keepKeyAfterFailure } from "./use-submit-guard";

describe("keepKeyAfterFailure", () => {
  test("keeps the key when the server may have posted (no response, 5xx)", () => {
    assert.equal(keepKeyAfterFailure(new Error("timeout")), true);
    assert.equal(keepKeyAfterFailure({ response: { status: 500 } }), true);
    assert.equal(keepKeyAfterFailure({ response: { status: 503 } }), true);
    assert.equal(keepKeyAfterFailure(null), true);
  });

  test("drops it when the server refused (4xx), so an edited retry is new", () => {
    assert.equal(keepKeyAfterFailure({ response: { status: 422 } }), false);
    assert.equal(keepKeyAfterFailure({ response: { status: 409 } }), false);
    assert.equal(keepKeyAfterFailure({ response: { status: 403 } }), false);
  });
});
