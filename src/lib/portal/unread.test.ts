import { test } from "node:test";
import assert from "node:assert/strict";
import { PORTAL_UNREAD_EVENT, onUnreadChanged, refreshUnread } from "./unread";

const fakeWindow = new EventTarget();
Object.assign(globalThis, { window: fakeWindow });

test("after a read, the server's new count reaches every listener (the bell and the page)", async () => {
  const heard: number[] = [];
  const stop = onUnreadChanged((count) => heard.push(count.total));
  const count = await refreshUnread(async () => ({ notifications: 2, announcements: 1, total: 3 }));
  assert.deepEqual(count, { notifications: 2, announcements: 1, total: 3 });
  assert.deepEqual(heard, [3]);
  stop();
  await refreshUnread(async () => ({ notifications: 0, announcements: 0, total: 0 }));
  assert.deepEqual(heard, [3], "a listener that stopped hears nothing");
});

test("a failed count read changes nothing and throws nothing", async () => {
  const heard: number[] = [];
  const stop = onUnreadChanged((count) => heard.push(count.total));
  assert.equal(await refreshUnread(async () => Promise.reject(new Error("offline"))), null);
  assert.deepEqual(heard, []);
  stop();
});

test("the event name is the portal's own", () => {
  assert.equal(PORTAL_UNREAD_EVENT, "portal:unread-changed");
});
