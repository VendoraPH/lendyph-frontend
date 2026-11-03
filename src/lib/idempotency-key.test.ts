import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { idempotencyHeaders, isUuidV4, mintIdempotencyKey } from "./idempotency-key";

describe("mintIdempotencyKey", () => {
  test("mints a v4 UUID from the real CSPRNG, different each time", () => {
    const a = mintIdempotencyKey();
    const b = mintIdempotencyKey();
    assert.ok(isUuidV4(a));
    assert.notEqual(a, b);
  });

  test("falls back to getRandomValues when randomUUID is missing", () => {
    const key = mintIdempotencyKey({ getRandomValues: (arr) => arr.fill(0xff) });
    assert.ok(isUuidV4(key));
  });

  test("returns null rather than a weak key when no CSPRNG exists", () => {
    assert.equal(mintIdempotencyKey(null), null);
    assert.equal(mintIdempotencyKey({}), null);
  });
});

describe("idempotencyHeaders", () => {
  test("sends the header only when a key exists", () => {
    assert.deepEqual(idempotencyHeaders("k"), { headers: { "Idempotency-Key": "k" } });
    assert.deepEqual(idempotencyHeaders(null), {});
  });
});
