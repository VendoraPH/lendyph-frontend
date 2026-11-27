/**
 * The loan page reads the loan again when staff come back to its tab, while a
 * printed document is out of date: the reprint happens in the print tab.
 *
 * WHAT THIS PROVES: a return (focus, or the tab shown again) reads once, even
 * when both events fire; nothing reads while the tab is hidden, while a read is
 * out, or after dispose; a failed read is swallowed and the next return reads
 * again. There is no timer to prove absent: the reader takes none.
 * WHAT IT DOES NOT PROVE: the browser events themselves (the hook wires them).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { RETURN_MIN_GAP_MS, createReturnReader } from "./reread-on-return";

function harness() {
  let clock = 0;
  let hidden = false;
  let reads = 0;
  const settle: Array<(ok: boolean) => void> = [];

  const reader = createReturnReader({
    read: () => {
      reads += 1;
      return new Promise((resolve, reject) => {
        settle.push((ok) => (ok ? resolve(undefined) : reject(new Error("failed"))));
      });
    },
    isHidden: () => hidden,
    now: () => clock,
  });

  return {
    reader,
    reads: () => reads,
    advance: (ms: number) => {
      clock += ms;
    },
    hide: (value: boolean) => {
      hidden = value;
    },
    async finishRead(ok = true) {
      settle.shift()?.(ok);
      // Let the reader's own `finally` run.
      await new Promise((resolve) => setImmediate(resolve));
    },
  };
}

test("coming back reads once, even when focus and visibility both fire", async () => {
  const h = harness();
  h.reader.handleReturn();
  h.reader.handleReturn();
  assert.equal(h.reads(), 1);
  await h.finishRead();
  h.reader.handleReturn();
  assert.equal(h.reads(), 1, "inside the gap: the same return");
});

test("a later return reads again", async () => {
  const h = harness();
  h.reader.handleReturn();
  await h.finishRead();
  h.advance(RETURN_MIN_GAP_MS);
  h.reader.handleReturn();
  assert.equal(h.reads(), 2);
});

test("nothing reads while the tab is hidden", () => {
  const h = harness();
  h.hide(true);
  h.reader.handleReturn();
  assert.equal(h.reads(), 0);
  h.hide(false);
  h.reader.handleReturn();
  assert.equal(h.reads(), 1);
});

test("one read at a time", async () => {
  const h = harness();
  h.reader.handleReturn();
  h.advance(RETURN_MIN_GAP_MS * 5);
  h.reader.handleReturn();
  assert.equal(h.reads(), 1, "the first read is still out");
  await h.finishRead();
  h.reader.handleReturn();
  assert.equal(h.reads(), 2);
});

test("a failed read is swallowed and the next return reads again", async () => {
  const h = harness();
  h.reader.handleReturn();
  await h.finishRead(false);
  h.advance(RETURN_MIN_GAP_MS);
  h.reader.handleReturn();
  assert.equal(h.reads(), 2);
});

test("nothing reads after dispose", () => {
  const h = harness();
  h.reader.dispose();
  h.reader.handleReturn();
  assert.equal(h.reads(), 0);
});
