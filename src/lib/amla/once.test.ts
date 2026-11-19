import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "./once";

test("a request asked for twice (React's development double effect) is sent once", async () => {
  let sent = 0;
  const read = once(() => Promise.resolve(++sent));
  const [a, b] = await Promise.all([read(), read()]);
  assert.equal(sent, 1);
  assert.equal(a, 1);
  assert.equal(b, 1);
});

test("a failed request is sent again on retry, never answered from the failure", async () => {
  let sent = 0;
  const read = once(() => (++sent === 1 ? Promise.reject(new Error("offline")) : Promise.resolve(sent)));
  await assert.rejects(read());
  assert.equal(await read(), 2);
  assert.equal(sent, 2);
});
