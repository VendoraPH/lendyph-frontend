import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { createSubmitGuard, keepKeyAfterFailure } from "./use-submit-guard";

/** A guard whose keys are "k1", "k2", … so a test can tell attempts apart. */
function guardWithCountedKeys() {
  let minted = 0;
  const busy: boolean[] = [];
  const guard = createSubmitGuard((b) => busy.push(b), () => `k${++minted}`);
  return { guard, busy };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (err: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

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

describe("createSubmitGuard", () => {
  test("blocks a second submit while the first is in flight", async () => {
    const { guard, busy } = guardWithCountedKeys();
    const pending = deferred<string>();
    let calls = 0;

    const first = guard.run(() => {
      calls++;
      return pending.promise;
    });
    const second = guard.run(() => {
      calls++;
      return Promise.resolve("twin");
    });

    assert.equal(second, null);
    assert.equal(calls, 1);
    assert.equal(guard.busy, true);

    pending.resolve("done");
    assert.equal(await first, "done");
    assert.equal(guard.busy, false);
    assert.deepEqual(busy, [true, false]);
  });

  test("reuses the key on a retry after a lost response or 5xx", async () => {
    const { guard } = guardWithCountedKeys();
    const keys: (string | null)[] = [];

    await assert.rejects(
      guard.run((key) => {
        keys.push(key);
        return Promise.reject({ response: { status: 503 } });
      })!,
    );
    await guard.run((key) => {
      keys.push(key);
      return Promise.resolve();
    });

    assert.deepEqual(keys, ["k1", "k1"]);
  });

  test("mints a new key after success and after a 4xx refusal", async () => {
    const { guard } = guardWithCountedKeys();
    const keys: (string | null)[] = [];
    const record = (key: string | null) => {
      keys.push(key);
      return Promise.resolve();
    };

    await guard.run(record);
    await assert.rejects(
      guard.run((key) => {
        keys.push(key);
        return Promise.reject({ response: { status: 422 } });
      })!,
    );
    await guard.run(record);

    assert.deepEqual(keys, ["k1", "k2", "k3"]);
  });

  test("frees the guard when the submit function throws before returning", async () => {
    const { guard } = guardWithCountedKeys();
    await assert.rejects(
      guard.run(() => {
        throw new Error("bad form");
      })!,
      /bad form/,
    );
    assert.equal(guard.busy, false);
    assert.notEqual(guard.run(() => Promise.resolve()), null);
  });
});
