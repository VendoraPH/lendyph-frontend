import { test } from "node:test";
import assert from "node:assert/strict";

class MemoryStorage {
  private items = new Map<string, string>();
  getItem(key: string) {
    return this.items.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.items.set(key, String(value));
  }
  removeItem(key: string) {
    this.items.delete(key);
  }
}
Object.assign(globalThis, { sessionStorage: new MemoryStorage(), window: new EventTarget() });

const load = () => Promise.all([import("./sign-out"), import("./portal-client")]);

test("signing out clears this tab at once, before the server answers, and sends the token it had", async () => {
  const [{ signOutMember }, { portalTokens }] = await load();
  portalTokens.set("MEMBER-TOKEN", 3600);
  const seen: string[] = [];
  let answer!: () => void;
  const done = signOutMember(
    () => seen.push(`cleared, token now ${portalTokens.get()}`),
    (token) => {
      seen.push(`sent ${token}`);
      return new Promise<void>((resolve) => (answer = resolve));
    },
  );
  assert.equal(portalTokens.get(), null);
  assert.deepEqual(seen, ["cleared, token now null", "sent MEMBER-TOKEN"]);
  answer();
  await done;
});

test("a failed or slow sign-out call still leaves the member signed out here", async () => {
  const [{ signOutMember }, { portalTokens }] = await load();
  portalTokens.set("MEMBER-TOKEN", 3600);
  let cleared = 0;
  await signOutMember(() => cleared++, () => Promise.reject(new Error("timeout of 5000ms exceeded")));
  assert.equal(cleared, 1);
  assert.equal(portalTokens.get(), null);
});

test("with no token there is nothing to send", async () => {
  const [{ signOutMember }, { portalTokens }] = await load();
  portalTokens.clear();
  let sent = 0;
  await signOutMember(() => undefined, async () => void sent++);
  assert.equal(sent, 0);
});
