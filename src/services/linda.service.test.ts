/**
 * `lindaService.chat` over real HTTP against a stub shaped like the
 * `POST /api/linda/chat` contract in the backend handoff.
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { AddressInfo } from "node:net";

let server: Server;
let lastBody: unknown;
let respondWith: { status: number; body: unknown };
let lindaService: typeof import("./linda.service").lindaService;

before(async () => {
  server = createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      res.setHeader("Content-Type", "application/json");
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
