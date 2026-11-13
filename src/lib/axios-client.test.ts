/**
 * A token renewal and the requests that go out while it runs.
 *
 * The API rotates the token on POST /auth/refresh, so a request sent with the
 * old token while the renewal is in flight is answered 401. It used to be sent
 * anyway, logged as a console error and then replayed with the new token. A
 * request must instead wait for the renewal and go out once, with the new
 * token. A failed renewal still ends the session exactly as before.
 *
 * The network is a mocked fetch (axios's fetch adapter), so nothing leaves the
 * process.
 */
import { test, before, beforeEach, afterEach, describe, mock } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import type { AxiosInstance, AxiosStatic } from "axios";

const API = "http://api.test/api";

interface Seen {
  path: string;
  auth: string | null;
  status: number;
}

/** What the mocked API holds and what it has answered. */
const server = {
  token: "old" as string | null,
  refreshCalls: 0,
  refreshStatus: 200,
  refreshNetworkError: false,
  /** A refresh the API never answers (stuck before it rotates anything). */
  refreshHangs: false,
  /** The API swaps the token only as it answers, so the old one works until then. */
  rotateOnReply: false,
  seen: [] as Seen[],
  releaseRefresh: () => {},
  refreshGate: Promise.resolve(),
  /** Hold the next Log out's answer until `releaseLogout()`. */
  holdLogout: false,
  releaseLogout: () => {},
  logoutGate: Promise.resolve(),
  /** How each hanging refresh is ended from outside (afterEach), so none outlives its test. */
  hanging: [] as ((reason: Error) => void)[],
};

/**
 * Event-driven waits: the mock server calls `changed()` whenever
 * `refreshCalls` or `seen` changes, and each waiter re-checks its condition
 * then. No turn counting, so a loaded machine only makes a wait longer, never
 * fails it; the test's own timeout bounds it.
 */
const waiters = new Set<() => void>();

function changed(): void {
  for (const check of [...waiters]) check();
}

function reached(done: () => boolean): Promise<void> {
  if (done()) return Promise.resolve();
  return new Promise<void>((resolve) => {
    const check = () => {
      if (!done()) return;
      waiters.delete(check);
      resolve();
    };
    waiters.add(check);
  });
}

function record(entry: Seen): void {
  server.seen.push(entry);
  changed();
}

function holdRefresh(): void {
  server.refreshGate = new Promise<void>((resolve) => {
    server.releaseRefresh = resolve;
  });
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function mockFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const request = input instanceof Request ? input : new Request(input, init);
  const path = new URL(request.url).pathname;
  const auth = request.headers.get("authorization");

  if (path.endsWith("/auth/refresh")) {
    server.refreshCalls += 1;
    // A hanging refresh ends only by the caller's own timeout, through the
    // request's signal, or by afterEach, when a test stops before that fires.
    const hang = server.refreshHangs
      ? new Promise<never>((_, reject) => {
          server.hanging.push(reject);
          request.signal.addEventListener("abort", () => reject(request.signal.reason), { once: true });
        })
      : null;
    changed();
    if (hang) await hang;
    const rotates = !server.refreshNetworkError && server.refreshStatus === 200 && auth === `Bearer ${server.token}`;
    // The API revokes the old token as it issues the new one, so from here a
    // request carrying the old token is answered 401.
    if (rotates && !server.rotateOnReply) server.token = "new";
    await server.refreshGate;
    if (rotates && server.rotateOnReply) server.token = "new";
    if (server.refreshNetworkError) throw new TypeError("fetch failed");
    if (!rotates) return json(server.refreshStatus === 200 ? 401 : server.refreshStatus, { message: "Unauthenticated." });
    return json(200, { token: "new", expires_in: 1800 });
  }

  if (path.endsWith("/auth/logout") && server.holdLogout) {
    server.holdLogout = false;
    await server.logoutGate;
  }

  const status = server.token !== null && auth === `Bearer ${server.token}` ? 200 : 401;
  record({ path, auth, status });
  // Log out revokes the token it was sent with.
  if (path.endsWith("/auth/logout") && status === 200) server.token = null;
  return json(status, status === 200 ? { data: { path } } : { message: "Unauthenticated." });
}

const store = new Map<string, string>();
const win = new EventTarget();
let sessionExpiredEvents = 0;
win.addEventListener("auth:session-expired", () => {
  sessionExpiredEvents += 1;
});

let client: AxiosInstance;
let renewAccessToken: () => Promise<string>;
let tokenManager: typeof import("./axios-client").tokenManager;
let REFRESH_TIMEOUT_MS: number;
let SessionEndedError: typeof import("./axios-client").SessionEndedError;

let authService: typeof import("../services/auth.service").authService;
let signOut: typeof import("./sign-out").signOut;

/** Every renewal a test starts, so afterEach can wait until it has cleared. */
const renewals: Promise<string>[] = [];

function renew(): Promise<string> {
  const renewal = renewAccessToken();
  renewals.push(renewal);
  return renewal;
}

/** A real-time limit per test, so a hang fails the test instead of the run, with room for a loaded machine. */
const LIMIT = { timeout: 30_000 };

/** Let queued promise work (interceptors, the adapter) run. */
async function settle(): Promise<void> {
  for (let i = 0; i < 10; i += 1) {
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
}

before(async () => {
  // Set BEFORE importing: axios-client resolves its baseURL at module init,
  // and with no window yet it uses the direct API URL.
  process.env.NEXT_PUBLIC_API_URL = API;
  // tsx may load axios twice, as ES and as CommonJS modules, each with its own
  // defaults, so the mock goes on both.
  const esmAxios = (await import("axios")).default;
  const cjsAxios = createRequire(import.meta.url)("axios") as AxiosStatic;
  const clientModule = await import("./axios-client");
  client = clientModule.default;
  renewAccessToken = clientModule.renewAccessToken;
  REFRESH_TIMEOUT_MS = clientModule.REFRESH_TIMEOUT_MS;
  SessionEndedError = clientModule.SessionEndedError;
  tokenManager = clientModule.tokenManager;
  authService = (await import("../services/auth.service")).authService;
  signOut = (await import("./sign-out")).signOut;

  // The renewal uses plain axios; every other request uses the client.
  for (const defaults of [esmAxios.defaults, cjsAxios.defaults, client.defaults]) {
    defaults.adapter = "fetch";
    defaults.env = { ...defaults.env, fetch: mockFetch };
  }

  Object.assign(globalThis, {
    window: win,
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, String(value)),
      removeItem: (key: string) => void store.delete(key),
    },
  });
});

beforeEach(() => {
  store.clear();
  server.token = "old";
  server.refreshCalls = 0;
  server.refreshStatus = 200;
  server.refreshNetworkError = false;
  server.refreshHangs = false;
  server.rotateOnReply = false;
  server.holdLogout = false;
  server.logoutGate = Promise.resolve();
  server.seen = [];
  server.hanging = [];
  sessionExpiredEvents = 0;
  holdRefresh();
  tokenManager.setAccessToken("old", 1800);
});

// A test that fails midway must not leave its renewal running into the next:
// every hanging refresh is ended while the mocked timers are still on, held
// answers are released, and the test waits until each renewal it started has
// cleared (the client then holds none).
afterEach(async () => {
  for (const reject of server.hanging.splice(0)) reject(new Error("test over"));
  mock.timers.reset();
  server.releaseRefresh();
  server.releaseLogout();
  await Promise.allSettled(renewals.splice(0));
  waiters.clear();
  await settle();
});

describe("requests while a token renewal is running", () => {
  test("two requests during one renewal make one refresh call, wait for it, and never 401", LIMIT, async () => {
    const renewal = renew();
    const first = client.get("/loans");
    const second = client.get("/borrowers");
    await settle();

    // Nothing has gone out with the token the renewal is replacing.
    assert.deepEqual(server.seen, []);

    server.releaseRefresh();
    assert.equal(await renewal, "new");
    const answers = await Promise.all([first, second]);

    assert.deepEqual(answers.map((a) => a.status), [200, 200]);
    assert.equal(server.refreshCalls, 1);
    assert.deepEqual(server.seen, [
      { path: "/api/loans", auth: "Bearer new", status: 200 },
      { path: "/api/borrowers", auth: "Bearer new", status: 200 },
    ]);
    assert.equal(tokenManager.getAccessToken(), "new");
    assert.equal(sessionExpiredEvents, 0);
  });

  test("a second renewal asked for while one runs shares it", LIMIT, async () => {
    const one = renew();
    const two = renew();
    server.releaseRefresh();
    assert.deepEqual(await Promise.all([one, two]), ["new", "new"]);
    assert.equal(server.refreshCalls, 1);
  });

  test("a request with no renewal running goes straight out with the token in hand", LIMIT, async () => {
    server.releaseRefresh();
    const answer = await client.get("/loans");
    assert.equal(answer.status, 200);
    assert.equal(server.refreshCalls, 0);
    assert.deepEqual(server.seen, [{ path: "/api/loans", auth: "Bearer old", status: 200 }]);
  });

  test("a rejected renewal still ends the session once, and the waiting request is refused here, never sent", LIMIT, async () => {
    server.refreshStatus = 401;
    const renewal = renew();
    const waiting = client.get("/loans");
    await settle();
    server.releaseRefresh();

    await assert.rejects(renewal, (err: { response?: { status?: number } }) => err.response?.status === 401);
    await assert.rejects(waiting, (err) => err instanceof SessionEndedError);

    assert.equal(tokenManager.getAccessToken(), null);
    assert.equal(sessionExpiredEvents, 1);
    assert.equal(server.refreshCalls, 1);
    // The session ended while it waited: it is refused in the browser, not sent to 401.
    assert.deepEqual(server.seen, []);
  });

  // A real-time limit, so a hang fails the test instead of the run.
  test("a renewal that never answers times out: the token is kept and the waiting requests go out with it", LIMIT, async () => {
    assert.ok(REFRESH_TIMEOUT_MS >= 10_000 && REFRESH_TIMEOUT_MS <= 20_000, "about 15 s");
    mock.timers.enable({ apis: ["setTimeout"] });
    server.refreshHangs = true;

    const renewal = renew();
    const first = client.get("/loans");
    const second = client.get("/borrowers");
    // The refresh reaches the API only after axios has set its timer.
    await reached(() => server.refreshCalls === 1);
    await settle();
    assert.deepEqual(server.seen, [], "they wait while the renewal runs");

    mock.timers.tick(REFRESH_TIMEOUT_MS);
    await assert.rejects(renewal, (err: { code?: string }) => err.code === "ETIMEDOUT" || err.code === "ECONNABORTED");
    const answers = await Promise.all([first, second]);

    assert.deepEqual(answers.map((a) => a.status), [200, 200]);
    assert.equal(tokenManager.getAccessToken(), "old");
    assert.equal(sessionExpiredEvents, 0);
    assert.equal(server.refreshCalls, 1);
    assert.deepEqual(server.seen, [
      { path: "/api/loans", auth: "Bearer old", status: 200 },
      { path: "/api/borrowers", auth: "Bearer old", status: 200 },
    ]);
  });

  // A real-time limit, so a hang fails the test instead of the run.
  test("Log out never waits on a stuck renewal", LIMIT, async () => {
    mock.timers.enable({ apis: ["setTimeout"] });
    server.refreshHangs = true;

    const renewal = renew();
    renewal.catch(() => undefined);
    await reached(() => server.refreshCalls === 1);
    // Answered while the renewal is still stuck, with no timer moved: were it
    // waiting on the renewal, this would never settle and the test would time out.
    const logout = await client.post("/auth/logout");
    assert.equal(logout.status, 200);
    assert.deepEqual(server.seen, [{ path: "/api/auth/logout", auth: "Bearer old", status: 200 }]);

    mock.timers.tick(REFRESH_TIMEOUT_MS);
    await assert.rejects(renewal);
  });

  test("a renewal that answers after Log out stores nothing and revokes the token it was given", LIMIT, async () => {
    server.rotateOnReply = true;
    const renewal = renew();
    await reached(() => server.refreshCalls === 1);

    // Log out finishes first, while the renewal is still out, then clears storage as the header does.
    assert.equal((await client.post("/auth/logout")).status, 200);
    tokenManager.clearTokens();

    // Then the refresh answers 200 with a new token.
    server.releaseRefresh();
    await assert.rejects(renewal);
    await reached(() => server.seen.length === 2);

    assert.equal(tokenManager.getAccessToken(), null, "the new token is not stored");
    assert.equal(tokenManager.getAccessTokenLifetime(), null);
    assert.deepEqual(server.seen, [
      { path: "/api/auth/logout", auth: "Bearer old", status: 200 },
      // Revoked with plain axios, carrying the new token.
      { path: "/api/auth/logout", auth: "Bearer new", status: 200 },
    ]);
    assert.equal(server.token, null, "the new token no longer works");
    // A deliberate Log out never shows "Session Expired".
    assert.equal(sessionExpiredEvents, 0);
  });

  test("Log out that gets 401 while a late renewal is out ends at once, and the late token is revoked", LIMIT, async () => {
    // The server renews on receipt, so the old token is already dead, but its answer is late.
    mock.timers.enable({ apis: ["setTimeout"] });
    const renewal = renew();
    renewal.catch(() => undefined);
    await reached(() => server.refreshCalls === 1);

    // With no timer moved and the renewal still out, Log out fails: no wait, no replay.
    // Were it waiting on the renewal, this would never settle and the test would time out.
    await assert.rejects(
      client.post("/auth/logout"),
      (err: { response?: { status?: number } }) => err.response?.status === 401,
    );
    assert.equal(tokenManager.getAccessToken(), null, "the session ends here");
    assert.equal(sessionExpiredEvents, 0, "a deliberate Log out shows no Session Expired dialog");
    assert.deepEqual(server.seen, [{ path: "/api/auth/logout", auth: "Bearer old", status: 401 }]);

    // Then the late answer arrives: not stored, and revoked.
    server.releaseRefresh();
    await assert.rejects(renewal);
    await reached(() => server.seen.length === 2);
    assert.equal(tokenManager.getAccessToken(), null);
    assert.deepEqual(server.seen[1], { path: "/api/auth/logout", auth: "Bearer new", status: 200 });
    assert.equal(server.token, null);
  });

  test("Log out that gets 401 after a renewal stored a new token revokes that token too", LIMIT, async () => {
    // The server renews on receipt, so the old token Log out carries is already dead.
    const renewal = renew();
    await reached(() => server.refreshCalls === 1);

    server.logoutGate = new Promise<void>((resolve) => {
      server.releaseLogout = resolve;
    });
    server.holdLogout = true;
    const logout = client.post("/auth/logout");
    logout.catch(() => undefined);

    // The renewal answers while Log out is out, and stores the token it renewed.
    server.releaseRefresh();
    assert.equal(await renewal, "new");
    assert.equal(tokenManager.getAccessToken(), "new");

    // Then Log out's 401 arrives: the session ends, and the stored token is revoked.
    server.releaseLogout();
    await assert.rejects(logout, (err: { response?: { status?: number } }) => err.response?.status === 401);
    assert.equal(tokenManager.getAccessToken(), null, "the session ends here");
    await reached(() => server.seen.length === 2);
    assert.deepEqual(server.seen, [
      { path: "/api/auth/logout", auth: "Bearer old", status: 401 },
      { path: "/api/auth/logout", auth: "Bearer new", status: 200 },
    ]);
    assert.equal(server.token, null, "the renewed token no longer works");
    assert.equal(sessionExpiredEvents, 0, "a deliberate Log out shows no Session Expired dialog");
  });

  test("a renewal that answers after another sign-in replaced the token keeps that one and revokes its own", LIMIT, async () => {
    server.rotateOnReply = true;
    const renewal = renew();
    await reached(() => server.refreshCalls === 1);

    tokenManager.setAccessToken("someone-else", 1800);
    server.releaseRefresh();

    assert.equal(await renewal, "someone-else");
    await reached(() => server.seen.length === 1);
    assert.equal(tokenManager.getAccessToken(), "someone-else");
    assert.deepEqual(server.seen, [{ path: "/api/auth/logout", auth: "Bearer new", status: 200 }]);
  });

  test("a renewal lost to the network keeps the session, and the waiting request uses the token in hand", LIMIT, async () => {
    server.refreshNetworkError = true;
    const renewal = renew();
    const waiting = client.get("/loans");
    await settle();
    server.releaseRefresh();

    await assert.rejects(renewal);
    const answer = await waiting;

    assert.equal(answer.status, 200);
    assert.equal(tokenManager.getAccessToken(), "old");
    assert.equal(sessionExpiredEvents, 0);
    assert.deepEqual(server.seen, [{ path: "/api/loans", auth: "Bearer old", status: 200 }]);
  });
});

describe("a deliberate sign-out", () => {
  const signOutNow = () =>
    signOut({
      getAccessToken: tokenManager.getAccessToken,
      clearTokens: tokenManager.clearTokens,
      logout: authService.logout,
    });

  test("clears storage first, and Log out still carries the token it revokes", LIMIT, async () => {
    server.releaseRefresh();
    await signOutNow();

    assert.deepEqual(server.seen, [{ path: "/api/auth/logout", auth: "Bearer old", status: 200 }]);
    assert.equal(server.token, null, "the token is revoked");
    assert.equal(tokenManager.getAccessToken(), null);
    assert.equal(sessionExpiredEvents, 0);
  });

  test("a Log out answered 401 signs out quietly: no Session Expired dialog", LIMIT, async () => {
    server.releaseRefresh();
    server.token = null;
    await signOutNow();

    assert.deepEqual(server.seen, [{ path: "/api/auth/logout", auth: "Bearer old", status: 401 }]);
    assert.equal(tokenManager.getAccessToken(), null);
    assert.equal(sessionExpiredEvents, 0);
  });

  test("a background read answered 401 after sign-out shows no Session Expired dialog", LIMIT, async () => {
    server.releaseRefresh();
    await signOutNow();
    // The bell's read, sent with the revoked token while Log out was out, answers late.
    await assert.rejects(
      client.get("/notifications/unread-count", { headers: { Authorization: "Bearer old" } }),
      (err: { response?: { status?: number } }) => err.response?.status === 401,
    );
    assert.equal(sessionExpiredEvents, 0);
  });

  test("Log out goes out at once while a renewal is stuck, and the renewal stores nothing", LIMIT, async () => {
    mock.timers.enable({ apis: ["setTimeout"] });
    server.refreshHangs = true;
    const renewal = renew();
    renewal.catch(() => undefined);
    await reached(() => server.refreshCalls === 1);

    // Settles with no timer moved: it never waits on the renewal.
    await signOutNow();
    assert.deepEqual(server.seen, [{ path: "/api/auth/logout", auth: "Bearer old", status: 200 }]);

    mock.timers.tick(REFRESH_TIMEOUT_MS);
    await assert.rejects(renewal);
    assert.equal(tokenManager.getAccessToken(), null);
    assert.equal(sessionExpiredEvents, 0);
  });
});
