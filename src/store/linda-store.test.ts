/**
 * Linda narrows the sidebar while it is open, without touching the user's own
 * collapse choice or what the `lendy-ui` store saves.
 */
import { test, before, beforeEach } from "node:test";
import assert from "node:assert/strict";

// The persist middleware writes to `window.localStorage`; this one is a Map,
// so the tests read what would really be saved. Each test file runs in its
// own process, so the stand-in `window` goes no further than this file.
const storage = new Map<string, string>();
Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: {
    localStorage: {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => void storage.set(k, v),
      removeItem: (k: string) => void storage.delete(k),
    },
  },
});

let ui: typeof import("./ui-store");
let useLindaStore: typeof import("./linda-store").useLindaStore;

before(async () => {
  ui = await import("./ui-store");
  useLindaStore = (await import("./linda-store")).useLindaStore;
});

const collapsed = () => ui.selectSidebarCollapsed(ui.useUIStore.getState());
const saved = () =>
  (JSON.parse(storage.get("lendy-ui") ?? "{}") as { state?: Record<string, unknown> }).state;

beforeEach(() => {
  useLindaStore.getState().closePanel();
  ui.useUIStore.setState({ sidebarCollapsed: false, sidebarAutoCollapsed: false });
});

test("opening Linda collapses the sidebar and closing gives it back", () => {
  useLindaStore.getState().openPanel();
  assert.equal(collapsed(), true);
  useLindaStore.getState().closePanel();
  assert.equal(collapsed(), false);
});

test("Linda's collapse is never saved, so a reload or another tab is unaffected", () => {
  useLindaStore.getState().openPanel();
  assert.equal(collapsed(), true);
  assert.deepEqual(saved(), { sidebarOpen: true, sidebarCollapsed: false });
});

test("a sidebar the user had collapsed stays collapsed after Linda closes", () => {
  ui.useUIStore.setState({ sidebarCollapsed: true });
  useLindaStore.getState().openPanel();
  useLindaStore.getState().closePanel();
  assert.equal(collapsed(), true);
});

test("expanding then collapsing the sidebar while Linda is open is the user's choice and is kept", () => {
  useLindaStore.getState().openPanel();
  ui.useUIStore.getState().toggleSidebarCollapsed();
  assert.equal(collapsed(), false, "the first toggle expands what the user sees");
  ui.useUIStore.getState().toggleSidebarCollapsed();
  useLindaStore.getState().closePanel();
  assert.equal(collapsed(), true);
  assert.equal(saved()?.sidebarCollapsed, true);
});

test("expanding the sidebar while Linda is open keeps it expanded after close", () => {
  useLindaStore.getState().openPanel();
  ui.useUIStore.getState().toggleSidebarCollapsed();
  useLindaStore.getState().closePanel();
  assert.equal(collapsed(), false);
});

test("the header button opens and closes the panel", () => {
  useLindaStore.getState().togglePanel();
  assert.equal(useLindaStore.getState().open, true);
  useLindaStore.getState().togglePanel();
  assert.equal(useLindaStore.getState().open, false);
  assert.equal(collapsed(), false);
});
