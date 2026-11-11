import { test } from "node:test";
import assert from "node:assert/strict";
import { CONFIRMS, NotConfirmedError, confirmed, whenConfirmed } from "./server-confirm";

test("success is reported only after the server answered with an expected status", async () => {
  const seen: string[] = [];
  let answer!: (value: { status: number; data: { id: number } }) => void;
  const write = new Promise<{ status: number; data: { id: number } }>((resolve) => (answer = resolve));
  const done = whenConfirmed(write, CONFIRMS.created, () => seen.push("success"), () => seen.push("failed"));
  await Promise.resolve();
  assert.deepEqual(seen, [], "nothing is shown while the server hasn't answered");
  answer({ status: 201, data: { id: 7 } });
  await done;
  assert.deepEqual(seen, ["success"]);
});

test("a 202 counts only where waiting for a second check is expected", async () => {
  const seen: string[] = [];
  await whenConfirmed(Promise.resolve({ status: 202, data: {} }), CONFIRMS.created, () => seen.push("success"), (e) => seen.push((e as Error).name));
  await whenConfirmed(Promise.resolve({ status: 202, data: {} }), CONFIRMS.createdOrQueued, () => seen.push("success"), () => seen.push("failed"));
  assert.deepEqual(seen, ["NotConfirmedError", "success"]);
});

test("a 200 where a 201 was due, or a refusal, is never a success", async () => {
  const seen: string[] = [];
  await whenConfirmed(Promise.resolve({ status: 200, data: {} }), CONFIRMS.created, () => seen.push("success"), () => seen.push("failed"));
  await whenConfirmed(Promise.reject(new Error("409")), CONFIRMS.created, () => seen.push("success"), () => seen.push("failed"));
  await whenConfirmed(null, CONFIRMS.created, () => seen.push("success"), () => seen.push("failed"));
  assert.deepEqual(seen, ["failed", "failed"], "a second click while one is in flight does nothing");
});

test("confirmed hands back the data or refuses", () => {
  assert.deepEqual(confirmed({ status: 200, data: { ok: 1 } }, CONFIRMS.done), { ok: 1 });
  assert.throws(() => confirmed({ status: 204, data: null }, CONFIRMS.done), NotConfirmedError);
});
