/**
 * Linda's store: where the panel, the expanded dialog and the /linda page are
 * open, and the one conversation all three show. Opening Linda leaves the
 * sidebar exactly as the user set it (the panel floats over the page), and the
 * conversation lives in memory only.
 */
import { test, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import type { LindaChatRequest, LindaReply } from "@/types/linda";

// The persist middleware writes to `window.localStorage`; this one is a Map,
// so the tests read what would really be saved. sessionStorage is a Map too,
// so a test can prove nothing of the conversation lands in either. Each test
// file runs in its own process, so the stand-in `window` goes no further than
// this file.
const storage = new Map<string, string>();
const session = new Map<string, string>();
const fakeStorage = (map: Map<string, string>) => ({
  getItem: (k: string) => map.get(k) ?? null,
  setItem: (k: string, v: string) => void map.set(k, v),
  removeItem: (k: string) => void map.delete(k),
});
Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: { localStorage: fakeStorage(storage), sessionStorage: fakeStorage(session) },
});

let ui: typeof import("./ui-store");
let auth: typeof import("./auth-store");
let useLindaStore: typeof import("./linda-store").useLindaStore;

before(async () => {
  ui = await import("./ui-store");
  auth = await import("./auth-store");
  useLindaStore = (await import("./linda-store")).useLindaStore;
});

const linda = () => useLindaStore.getState();
const collapsed = () => ui.selectSidebarCollapsed(ui.useUIStore.getState());
const saved = () =>
  (JSON.parse(storage.get("lendy-ui") ?? "{}") as { state?: Record<string, unknown> }).state;

const reply = (answer: string): LindaReply => ({
  intent: "collection_summary",
  answer,
  blocks: [],
  links: [],
});

/** A chat whose answers the test releases by hand, recording each request. */
function heldChat() {
  const calls: { request: LindaChatRequest; signal?: AbortSignal }[] = [];
  const settle: { resolve: (r: LindaReply) => void; reject: (e: unknown) => void }[] = [];
  const chat = (request: LindaChatRequest, signal?: AbortSignal) =>
    new Promise<LindaReply>((resolve, reject) => {
      calls.push({ request, signal });
      settle.push({ resolve, reject });
    });
  return { chat, calls, settle };
}

const answered = (answer: string) => () => Promise.resolve(reply(answer));

beforeEach(() => {
  linda().reset();
  ui.useUIStore.setState({ sidebarCollapsed: false });
});

// ---------------------------------------------------------------------------
// The sidebar
// ---------------------------------------------------------------------------

test("opening and closing Linda leaves an expanded sidebar expanded", () => {
  linda().openPanel();
  assert.equal(collapsed(), false, "the panel floats over the page; the sidebar keeps its width");
  linda().close();
  assert.equal(collapsed(), false);
});

test("opening and closing Linda leaves a collapsed sidebar collapsed", () => {
  ui.useUIStore.setState({ sidebarCollapsed: true });
  linda().openPanel();
  assert.equal(collapsed(), true);
  linda().close();
  assert.equal(collapsed(), true);
});

test("Linda never writes the sidebar setting the app saves", () => {
  linda().openPanel();
  linda().close();
  assert.deepEqual(saved(), { sidebarOpen: true, sidebarCollapsed: false });
});

test("toggling the sidebar while Linda is open is the user's choice and is kept", () => {
  linda().openPanel();
  ui.useUIStore.getState().toggleSidebarCollapsed();
  assert.equal(collapsed(), true);
  linda().close();
  assert.equal(collapsed(), true);
  assert.equal(saved()?.sidebarCollapsed, true);
});

test("the floating button opens and closes the panel", () => {
  linda().togglePanel();
  assert.equal(linda().open, true);
  linda().togglePanel();
  assert.equal(linda().open, false);
  assert.equal(collapsed(), false);
});

test("the expanded dialog replaces the panel, and the sidebar never moves", () => {
  linda().openPanel();
  linda().expand();
  assert.equal(linda().open, false);
  assert.equal(linda().expanded, true);
  assert.equal(collapsed(), false);
  linda().collapse();
  assert.equal(linda().open, true);
  assert.equal(linda().expanded, false);
  assert.equal(collapsed(), false);
});

// ---------------------------------------------------------------------------
// One conversation
// ---------------------------------------------------------------------------

test("the panel, the expanded dialog and the /linda page share one conversation", async () => {
  linda().openPanel();
  assert.equal(await linda().send("How many active loans do we have?", answered("12 active loans.")), true);
  const before = linda().messages;
  assert.equal(before.length, 2);

  linda().expand();
  assert.equal(linda().messages, before, "expanding keeps the conversation");
  linda().setDraft("And last month?");
  linda().collapse();
  assert.equal(linda().messages, before, "collapsing back to the panel keeps it");
  assert.equal(linda().draft, "And last month?", "the question being typed carries over too");

  // Moving to /linda (or following a link in a reply) hides the panel without closing Linda.
  linda().hide();
  assert.equal(linda().open, false);
  assert.equal(linda().expanded, false);
  assert.equal(linda().messages, before, "leaving a page keeps the conversation");
});

test("closing the panel clears the conversation and the question being typed", async () => {
  linda().openPanel();
  await linda().send("How much have we collected this month?", answered("₱1,500.00"));
  linda().setDraft("half typed");
  linda().close();
  assert.deepEqual(linda().messages, []);
  assert.equal(linda().draft, "");
  assert.equal(linda().pending, false);
});

test("closing the expanded dialog clears the conversation too", async () => {
  linda().openPanel();
  await linda().send("How many active loans do we have?", answered("12"));
  linda().expand();
  linda().close();
  assert.equal(linda().expanded, false);
  assert.equal(linda().open, false);
  assert.deepEqual(linda().messages, []);
});

test("New chat clears the conversation and keeps Linda where she is", async () => {
  linda().openPanel();
  await linda().send("How many active loans do we have?", answered("12"));
  linda().newChat();
  assert.deepEqual(linda().messages, []);
  assert.equal(linda().open, true);
});

test("signing out clears the conversation and closes Linda", async () => {
  auth.useAuthStore.setState({ user: { id: 7 } as never, isAuthenticated: true });
  linda().openPanel();
  await linda().send("How many active loans do we have?", answered("12"));
  auth.useAuthStore.getState().clearAuth();
  assert.deepEqual(linda().messages, []);
  assert.equal(linda().open, false);
  assert.equal(collapsed(), false);
});

test("a different user signing in never sees the last user's conversation", async () => {
  auth.useAuthStore.setState({ user: { id: 7 } as never, isAuthenticated: true });
  await linda().send("How many active loans do we have?", answered("12"));
  auth.useAuthStore.setState({ user: { id: 8 } as never, isAuthenticated: true });
  assert.deepEqual(linda().messages, []);
});

test("the conversation is never written to localStorage or sessionStorage", async () => {
  storage.clear();
  session.clear();
  linda().openPanel();
  await linda().send("Which members currently have overdue payments?", answered("Juan dela Cruz owes ₱900.00"));
  linda().setDraft("draft text");
  linda().expand();
  assert.equal(session.size, 0);
  for (const [key, value] of storage) {
    assert.doesNotMatch(value, /overdue|Juan|draft text/, key);
  }
});

test("closing aborts the question in flight, and its late answer is dropped", async () => {
  const held = heldChat();
  linda().openPanel();
  const result = linda().send("How many active loans do we have?", held.chat);
  assert.equal(linda().pending, true);
  linda().close();
  assert.equal(held.calls[0].signal?.aborted, true);
  held.settle[0].resolve(reply("12"));
  assert.equal(await result, false);
  assert.deepEqual(linda().messages, []);
  assert.equal(linda().pending, false);
});

test("a late answer from before New chat never lands in the new conversation", async () => {
  const held = heldChat();
  const first = linda().send("How many active loans do we have?", held.chat);
  linda().newChat();
  assert.equal(held.calls[0].signal?.aborted, true);
  assert.equal(await linda().send("How much have we disbursed this month?", answered("₱50,000.00")), true);
  held.settle[0].resolve(reply("12"));
  await first;
  assert.deepEqual(
    linda().messages.map((m) => m.content),
    ["How much have we disbursed this month?", "₱50,000.00"],
  );
});

test("one question at a time, even on a fast double Enter", async () => {
  const held = heldChat();
  const first = linda().send("How many active loans do we have?", held.chat);
  assert.equal(await linda().send("Again", held.chat), false);
  assert.equal(held.calls.length, 1);
  held.settle[0].resolve(reply("12"));
  assert.equal(await first, true);
});

test("a question goes out trimmed to 500 characters, with the earlier turns as history", async () => {
  const held = heldChat();
  const first = linda().send("  How many active loans do we have?  ", held.chat);
  assert.equal(held.calls[0].request.message, "How many active loans do we have?");
  assert.deepEqual(held.calls[0].request.history, []);
  held.settle[0].resolve(reply("12"));
  await first;

  const second = linda().send("x".repeat(600), held.chat);
  assert.equal(held.calls[1].request.message.length, 500);
  assert.deepEqual(held.calls[1].request.history, [
    { role: "user", content: "How many active loans do we have?" },
    { role: "assistant", content: "", intent: "collection_summary" },
  ]);
  held.settle[1].resolve(reply("ok"));
  await second;
});

test("the box keeps the question until Linda answers, so a failure can be retried", async () => {
  linda().setDraft("How many active loans do we have?");
  const failed = await linda().send("How many active loans do we have?", () => Promise.reject(new Error("down")));
  assert.equal(failed, false);
  assert.equal(linda().draft, "How many active loans do we have?");
  const last = linda().messages.at(-1);
  assert.equal(last?.failed, true);
  assert.equal(last?.content, "Linda is currently unable to process your request. Please try again.");

  await linda().send("How many active loans do we have?", answered("12"));
  assert.equal(linda().draft, "");
});

test("anything typed while waiting is kept when the answer arrives", async () => {
  const held = heldChat();
  const sent = linda().send("How many active loans do we have?", held.chat);
  linda().setDraft("And last month?");
  held.settle[0].resolve(reply("12"));
  await sent;
  assert.equal(linda().draft, "And last month?");
});

test("an empty question sends nothing", async () => {
  const held = heldChat();
  assert.equal(await linda().send("   ", held.chat), false);
  assert.equal(held.calls.length, 0);
});
