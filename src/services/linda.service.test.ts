/**
 * `lindaService` over real HTTP against a stub shaped like the backend's
 * `POST /api/linda/chat` and `GET`/`PUT /api/linda/settings` contract.
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { AddressInfo } from "node:net";

let server: Server;
let lastBody: unknown;
let lastMethod: string | undefined;
let respondWith: { status: number; body: unknown };
let lindaService: typeof import("./linda.service").lindaService;

before(async () => {
  server = createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      res.setHeader("Content-Type", "application/json");
      lastMethod = req.method;
      if ((req.method === "GET" || req.method === "PUT") && req.url === "/api/linda/settings") {
        lastBody = raw ? JSON.parse(raw) : undefined;
        res.statusCode = respondWith.status;
        return res.end(JSON.stringify(respondWith.body));
      }
      if (req.method === "POST" && req.url === "/api/linda/chat") {
        lastBody = JSON.parse(raw || "null");
        res.statusCode = respondWith.status;
        return res.end(JSON.stringify(respondWith.body));
      }
      res.statusCode = 404;
      res.end("{}");
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  process.env.NEXT_PUBLIC_API_URL = `http://127.0.0.1:${port}/api`;
  lindaService = (await import("./linda.service")).lindaService;
});

after(() => {
  server?.close();
});

test("sends only the question and history, and unwraps the reply", async () => {
  respondWith = {
    status: 200,
    body: {
      success: true,
      data: {
        intent: "collection_summary",
        answer: "Your total collection for September is ₱245,600 from 82 payments.",
        blocks: [{ type: "stats", items: [{ label: "Collected", value: 245600, format: "currency" }] }],
        links: [],
      },
    },
  };
  const history = [{ role: "user" as const, content: "hi" }];
  const r = await lindaService.chat({ message: "How much did we collect this month?", history });
  assert.deepEqual(lastBody, { message: "How much did we collect this month?", history });
  assert.equal(r.intent, "collection_summary");
  assert.equal(r.blocks.length, 1);
});

test("rejects a body that is not a Linda reply", async () => {
  respondWith = { status: 200, body: { success: true, data: { foo: 1 } } };
  await assert.rejects(lindaService.chat({ message: "x", history: [] }));
});

test("surfaces the HTTP status for the panel to word", async () => {
  respondWith = { status: 503, body: { success: false, error_code: "data_unavailable", message: "SQLSTATE..." } };
  await assert.rejects(lindaService.chat({ message: "x", history: [] }), (err: { response?: { status?: number; data?: { error_code?: string } } }) => {
    assert.equal(err.response?.status, 503);
    assert.equal(err.response?.data?.error_code, "data_unavailable");
    return true;
  });
});

const SETTINGS = {
  model: "claude-haiku-5-5",
  models: [
    {
      id: "claude-haiku-5-5",
      label: "Claude Haiku 5.5",
      description: "Fast and low cost.",
      input_per_million: "6.20",
      output_per_million: "31.00",
      per_question: "0.01",
    },
  ],
  ai: { on: false, reason: "model_off" },
  month: { label: "November 2026", cost: "0.00", cap: "1000.00", questions: 0, model_questions: 0 },
  updated_at: null,
  updated_by: null,
};

test("reads the Linda settings and unwraps them", async () => {
  respondWith = { status: 200, body: { success: true, data: SETTINGS } };
  const settings = await lindaService.getSettings();
  assert.equal(lastMethod, "GET");
  assert.deepEqual(settings, SETTINGS);
});

test("saves only the chosen model, and returns the server's settings", async () => {
  const saved = { ...SETTINGS, model: "claude-sonnet-5-5", updated_by: "Jane Admin" };
  respondWith = { status: 200, body: { success: true, data: saved } };
  const settings = await lindaService.updateSettings({ model: "claude-sonnet-5-5" });
  assert.equal(lastMethod, "PUT");
  assert.deepEqual(lastBody, { model: "claude-sonnet-5-5" });
  assert.equal(settings.model, "claude-sonnet-5-5");
  assert.equal(settings.updated_by, "Jane Admin");
});

test("a refused model surfaces the 422 for the page to word", async () => {
  respondWith = {
    status: 422,
    body: { success: false, message: "The selected model is invalid.", errors: { model: ["The selected model is invalid."] } },
  };
  await assert.rejects(lindaService.updateSettings({ model: "gpt" }), (err: { response?: { status?: number } }) => {
    assert.equal(err.response?.status, 422);
    return true;
  });
});
