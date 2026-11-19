/**
 * The sidebar's remembered "new" ids: kept per user, ids only, and a blocked,
 * full or damaged localStorage never breaks the sidebar.
 */
import { test, before, beforeEach } from "node:test";
import assert from "node:assert/strict";

// The persist middleware writes to `window.localStorage`. This stand-in can be
// made to throw on every call, as a blocked (SecurityError) or full
// (QuotaExceededError) storage does. Each test file runs in its own process.
const storage = new Map<string, string>();
let failing = false;
const fail = () => {
  throw new Error("QuotaExceededError");
};
Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: {
    localStorage: {
      getItem: (k: string) => (failing ? fail() : (storage.get(k) ?? null)),
      setItem: (k: string, v: string) => (failing ? fail() : void storage.set(k, v)),
      removeItem: (k: string) => (failing ? fail() : void storage.delete(k)),
    },
  },
});

let store: typeof import("./nav-seen-store").useNavSeenStore;

before(async () => {
  store = (await import("./nav-seen-store")).useNavSeenStore;
});

beforeEach(() => {
  failing = false;
  storage.clear();
  store.setState({ seen: {}, feed: null });
});

const saved = () => JSON.parse(storage.get("lendy-nav-seen") ?? "{}") as { state?: Record<string, unknown> };

test("saves only the seen ids, per user, never the unread rows", () => {
  store.getState().setFeed({ owner: "7", count: 1, at: 1, complete: true, rows: [{ id: "a", url: "/loans/1" }] });
  store.getState().markSeen("7", ["a"]);
  assert.deepEqual(saved().state, { seen: { "7": ["a"] } });
});

test("a storage that throws on write leaves the sidebar working", () => {
  failing = true;
  assert.doesNotThrow(() => store.getState().markSeen("7", ["a"]));
  assert.deepEqual(store.getState().seen, { "7": ["a"] });
});

test("a storage that throws on read hydrates to nothing", async () => {
  failing = true;
  await assert.doesNotReject(async () => store.persist.rehydrate());
  assert.deepEqual(store.getState().seen, {});
});

test("a damaged saved value is cleaned up on load", async () => {
  storage.set("lendy-nav-seen", JSON.stringify({ state: { seen: { "7": "oops", "8": ["b", 4] } }, version: 0 }));
  await store.persist.rehydrate();
  assert.deepEqual(store.getState().seen, { "8": ["b"] });
  assert.doesNotThrow(() => store.getState().markSeen("7", ["a"]));
});

test("unreadable JSON hydrates to nothing", async () => {
  storage.set("lendy-nav-seen", "{not json");
  await assert.doesNotReject(async () => store.persist.rehydrate());
  assert.deepEqual(store.getState().seen, {});
});
