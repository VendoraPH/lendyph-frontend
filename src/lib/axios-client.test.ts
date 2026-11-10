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
import { test, before, beforeEach, afterEach, describe } from "node:test";
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
  token: "old",
  refreshCalls: 0,
  refreshStatus: 200,
  refreshNetworkError: false,
  seen: [] as Seen[],
  releaseRefresh: () => {},
  refreshGate: Promise.resolve(),
};

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
    const rotates = !server.refreshNetworkError && server.refreshStatus === 200 && auth === `Bearer ${server.token}`;
    // The API revokes the old token as it issues the new one, so from here a
    // request carrying the old token is answered 401.
    if (rotates) server.token = "new";
    await server.refreshGate;
    if (server.refreshNetworkError) throw new TypeError("fetch failed");
    if (!rotates) return json(server.refreshStatus === 200 ? 401 : server.refreshStatus, { message: "Unauthenticated." });
    return json(200, { token: "new", expires_in: 1800 });
  }

  const status = auth === `Bearer ${server.token}` ? 200 : 401;
  server.seen.push({ path, auth, status });
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
  tokenManager = clientModule.tokenManager;

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
  server.seen = [];
  sessionExpiredEvents = 0;
  holdRefresh();
  tokenManager.setAccessToken("old", 1800);
});

// A test that fails midway must not leave its renewal running into the next.
afterEach(async () => {
  server.releaseRefresh();
  await settle();
});

describe("requests while a token renewal is running", () => {
  test("two requests during one renewal make one refresh call, wait for it, and never 401", async () => {
    const renewal = renewAccessToken();
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

  test("a second renewal asked for while one runs shares it", async () => {
    const one = renewAccessToken();
    const two = renewAccessToken();
    server.releaseRefresh();
    assert.deepEqual(await Promise.all([one, two]), ["new", "new"]);
    assert.equal(server.refreshCalls, 1);
  });

  test("a request with no renewal running goes straight out with the token in hand", async () => {
    server.releaseRefresh();
    const answer = await client.get("/loans");
    assert.equal(answer.status, 200);
    assert.equal(server.refreshCalls, 0);
    assert.deepEqual(server.seen, [{ path: "/api/loans", auth: "Bearer old", status: 200 }]);
  });

  test("a rejected renewal still ends the session once, and the waiting request fails", async () => {
    server.refreshStatus = 401;
    const renewal = renewAccessToken();
    const waiting = client.get("/loans");
    await settle();
    server.releaseRefresh();

    await assert.rejects(renewal, (err: { response?: { status?: number } }) => err.response?.status === 401);
    await assert.rejects(waiting, (err: { response?: { status?: number } }) => err.response?.status === 401);

    assert.equal(tokenManager.getAccessToken(), null);
    assert.equal(sessionExpiredEvents, 1);
    assert.equal(server.refreshCalls, 1);
    // It went out after the session ended, with no token, and was not replayed.
    assert.deepEqual(server.seen, [{ path: "/api/loans", auth: null, status: 401 }]);
  });

  test("a renewal lost to the network keeps the session, and the waiting request uses the token in hand", async () => {
    server.refreshNetworkError = true;
    const renewal = renewAccessToken();
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
