import { before, test } from "node:test";
import assert from "node:assert/strict";
import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from "axios";

// A browser's two stores, so the client can be run here: the staff app's
// token sits in localStorage, as it does when a staff member who is also a
// member has both apps open in one browser.
class MemoryStorage implements Storage {
  private items = new Map<string, string>();
  get length() {
    return this.items.size;
  }
  clear() {
    this.items.clear();
  }
  getItem(key: string) {
    return this.items.get(key) ?? null;
  }
  key(index: number) {
    return [...this.items.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.items.delete(key);
  }
  setItem(key: string, value: string) {
    this.items.set(key, String(value));
  }
}

const session = new MemoryStorage();
const local = new MemoryStorage();
const events: string[] = [];
const fakeWindow = new EventTarget();
fakeWindow.addEventListener("portal:session-ended", () => events.push("ended"));
fakeWindow.addEventListener("portal:terms-required", () => events.push("terms"));
Object.assign(globalThis, { sessionStorage: session, localStorage: local, window: fakeWindow });
local.setItem("lendy_access_token", "STAFF-TOKEN");

type Client = typeof import("./portal-client");
let portalTokens: Client["portalTokens"];
let portalNotice: Client["portalNotice"];
let portalApi: Client["portalApi"];
let publicAssetUrl: Client["publicAssetUrl"];
let logoutWith: Client["logoutWith"];

interface Answer {
  status: number;
  data: unknown;
}
const sent: InternalAxiosRequestConfig[] = [];
let answer: Answer = { status: 200, data: { success: true, data: {} } };

before(async () => {
  const client = await import("./portal-client");
  ({ portalTokens, portalNotice, portalApi, publicAssetUrl, logoutWith } = client);
  client.portalHttp.defaults.adapter = async (config) => {
    sent.push(config);
    const response = { status: answer.status, statusText: "", headers: {}, config, data: answer.data };
    if (answer.status >= 400) throw new AxiosError("refused", "ERR_BAD_REQUEST", config, null, response);
    return response;
  };
});

function authorization(config: InternalAxiosRequestConfig | undefined): unknown {
  return AxiosHeaders.from(config?.headers ?? {}).get("Authorization");
}

test("the member's token is read from sessionStorage and nowhere else", async () => {
  portalTokens.set("MEMBER-TOKEN", 3600);
  assert.equal(session.getItem("lendy_member_token"), "MEMBER-TOKEN");
  assert.equal(local.getItem("lendy_member_token"), null, "never written to localStorage");
  await portalApi.get("/portal/dashboard");
  assert.equal(authorization(sent.at(-1)), "Bearer MEMBER-TOKEN");
});

test("the staff token is never sent, even with no member token at all", async () => {
  portalTokens.clear();
  await portalApi.get("/portal/config");
  assert.equal(authorization(sent.at(-1)), undefined);
  await portalApi.get("/portal/dashboard", { headers: { Authorization: "Bearer STAFF-TOKEN" } });
  assert.equal(authorization(sent.at(-1)), undefined, "a header a caller slips in is removed");
});

test("an idle 401 ends the session with the idle notice", async () => {
  events.length = 0;
  portalTokens.set("MEMBER-TOKEN", 3600);
  answer = { status: 401, data: { message: "Your session ended after a period of inactivity.", code: "session_idle" } };
  await assert.rejects(portalApi.get("/portal/dashboard"));
  assert.equal(portalTokens.get(), null);
  assert.deepEqual(events, ["ended"]);
  assert.match(portalNotice.read() ?? "", /inactivity/);
  assert.equal(local.getItem("lendy_access_token"), "STAFF-TOKEN", "the staff session is left alone");
});

test("a wrong password on sign-in is an answer, not a session ending", async () => {
  events.length = 0;
  portalTokens.set("MEMBER-TOKEN", 3600);
  answer = { status: 401, data: { message: "The member number or password is incorrect." } };
  await assert.rejects(portalApi.post("/portal/auth/login", { member_number: "x", password: "y" }));
  assert.equal(portalTokens.get(), "MEMBER-TOKEN");
  assert.deepEqual(events, []);
});

test("access turned off mid-session ends it; new terms send the member to them", async () => {
  events.length = 0;
  answer = { status: 403, data: { code: "terms_required" } };
  await assert.rejects(portalApi.get("/portal/loans"));
  assert.deepEqual(events, ["terms"]);
  assert.equal(portalTokens.get(), "MEMBER-TOKEN", "terms keep the session");

  answer = { status: 403, data: { code: "portal_access_disabled" } };
  await assert.rejects(portalApi.get("/portal/loans"));
  assert.deepEqual(events, ["terms", "ended"]);
  assert.equal(portalTokens.get(), null);
  assert.match(portalNotice.read() ?? "", /turned off/);
});

test("a plain 403 (a switched-off part) keeps the session", async () => {
  events.length = 0;
  portalTokens.set("MEMBER-TOKEN", 3600);
  answer = { status: 403, data: { code: "feature_off" } };
  await assert.rejects(portalApi.get("/portal/savings"));
  assert.deepEqual(events, []);
  assert.equal(portalTokens.get(), "MEMBER-TOKEN");
});

test("a confirmed write hands back the server's status", async () => {
  answer = { status: 201, data: { success: true, data: { id: 5 } } };
  assert.deepEqual(await portalApi.postConfirmed("/portal/requests", {}), { status: 201, data: { id: 5 } });
  answer = { status: 200, data: { success: true, data: {} } };
});

test("the logo is a plain same-origin address from the config's path, nothing else", () => {
  assert.equal(publicAssetUrl("/branding/logo"), "/api/proxy/branding/logo");
  for (const bad of [null, undefined, "", "https://evil.example/logo.png", "//evil.example/x", "/branding/../auth/me", "javascript:alert(1)", "/a b"]) {
    assert.equal(publicAssetUrl(bad), null, String(bad));
  }
});

test("the sign-out call carries the token it was given, with a short timeout, after the tab forgot it", async () => {
  portalTokens.clear();
  events.length = 0;
  answer = { status: 401, data: { message: "Unauthenticated." } };
  await assert.rejects(logoutWith("OLD-TOKEN"));
  const call = sent.at(-1);
  assert.equal(authorization(call), "Bearer OLD-TOKEN");
  assert.equal(call?.timeout, 5000);
  assert.equal(call?.url, "/portal/auth/logout");
  assert.deepEqual(events, [], "an already-ended token on sign-out ends nothing further");
  answer = { status: 200, data: { success: true, data: {} } };
});
