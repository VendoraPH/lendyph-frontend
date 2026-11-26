/**
 * The visibility source: what the menus, pages and Linda read to know which
 * modules this deployment hides.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createMenuVisibilityStore, retryDelayMs } from "./menu-visibility-store";

/** A fetcher the test answers by hand, and a timer it fires by hand. */
function harness() {
  const answers: { resolve: (hidden: string[]) => void; reject: (err: unknown) => void }[] = [];
  const fetch = () =>
    new Promise<{ hidden: string[] }>((resolve, reject) => {
      answers.push({ resolve: (hidden) => resolve({ hidden }), reject });
    });
  const timers: { fn: () => void; ms: number; cleared: boolean }[] = [];
  const schedule = (fn: () => void, ms: number) => {
    const timer = { fn, ms, cleared: false };
    timers.push(timer);
    return () => {
      timer.cleared = true;
    };
  };
  const store = createMenuVisibilityStore(fetch, schedule);
  return { store, answers, timers };
}

const tick = () => new Promise((r) => setImmediate(r));

test("nothing is known, and nothing is hidden, until the first answer", () => {
  const { store } = harness();
  assert.equal(store.getState().loaded, false);
  assert.equal(store.getState().isHidden("savings"), false);
});

test("an answer sets the hidden keys, and a hidden parent hides its submenus", async () => {
  const { store, answers } = harness();
  const done = store.getState().load();
  answers[0].resolve(["loans", "linda"]);
  await done;
  const s = store.getState();
  assert.equal(s.loaded, true);
  assert.equal(s.isHidden("linda"), true);
  assert.equal(s.isHidden("loans.reminders"), true);
  assert.equal(s.isHidden("payments"), false);
});

test("loads asked for while one is on its way share it", async () => {
  const { store, answers } = harness();
  const a = store.getState().load();
  const b = store.getState().load();
  assert.equal(answers.length, 1);
  answers[0].resolve([]);
  await Promise.all([a, b]);
});

test("a failed first load settles with nothing hidden, and retries", async () => {
  const { store, answers, timers } = harness();
  const done = store.getState().load();
  answers[0].reject(new Error("offline"));
  await done;
  assert.equal(store.getState().loaded, true);
  assert.deepEqual(store.getState().hidden, []);
  assert.equal(timers.length, 1);
  assert.equal(timers[0].ms, retryDelayMs(1));
  timers[0].fn();
  await tick();
  answers[1].resolve(["cda"]);
  await tick();
  assert.equal(store.getState().isHidden("cda"), true);
});

test("a failed later load keeps the last known list", async () => {
  const { store, answers } = harness();
  const first = store.getState().load();
  answers[0].resolve(["savings"]);
  await first;
  const second = store.getState().load();
  answers[1].reject(new Error("500"));
  await second;
  assert.equal(store.getState().isHidden("savings"), true);
});

test("a successful load cancels a pending retry, and stop cancels it too", async () => {
  const { store, answers, timers } = harness();
  const first = store.getState().load();
  answers[0].reject(new Error("offline"));
  await first;
  const second = store.getState().load();
  answers[1].resolve([]);
  await second;
  assert.equal(timers[0].cleared, true);
  const third = store.getState().load();
  answers[2].reject(new Error("offline"));
  await third;
  store.getState().stop();
  assert.equal(timers[1].cleared, true);
});

test("retries back off and are capped at a minute", () => {
  assert.equal(retryDelayMs(1), 5_000);
  assert.equal(retryDelayMs(2), 10_000);
  assert.equal(retryDelayMs(3), 20_000);
  assert.equal(retryDelayMs(10), 60_000);
});

test("only strings are kept from an answer", async () => {
  const { store, answers } = harness();
  const done = store.getState().load();
  answers[0].resolve(["savings", 3, null] as unknown as string[]);
  await done;
  assert.deepEqual(store.getState().hidden, ["savings"]);
});
