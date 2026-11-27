import { test } from "node:test";
import assert from "node:assert/strict";
import { oncePerKey } from "./once-per-key";

test("the same key loads once, however many times it is asked for", async () => {
  const read = oncePerKey<string>();
  let calls = 0;
  const load = () => {
    calls++;
    return Promise.resolve("candidates");
  };
  const answers = await Promise.all([read("12:41", load), read("12:41", load), read("12:41", load)]);
  assert.deepEqual(answers, ["candidates", "candidates", "candidates"]);
  assert.equal(await read("12:41", load), "candidates");
  assert.equal(calls, 1);
});

test("a new key (the next pending step) loads its own answer", async () => {
  const read = oncePerKey<string>();
  const keys: string[] = [];
  const loadFor = (key: string) => () => {
    keys.push(key);
    return Promise.resolve(key);
  };
  assert.equal(await read("12:41", loadFor("12:41")), "12:41");
  assert.equal(await read("12:42", loadFor("12:42")), "12:42");
  assert.equal(await read("12:41", loadFor("12:41")), "12:41");
  assert.deepEqual(keys, ["12:41", "12:42"]);
});

test("a failed read is forgotten, so Try again asks the server again", async () => {
  const read = oncePerKey<string>();
  let calls = 0;
  const failing = () => {
    calls++;
    return Promise.reject(new Error("offline"));
  };
  await assert.rejects(read("12:41", failing));
  const answer = await read("12:41", () => {
    calls++;
    return Promise.resolve("candidates");
  });
  assert.equal(answer, "candidates");
  assert.equal(calls, 2);
});
