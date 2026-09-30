/**
 * `systemService.health`, over real HTTP against a stub shaped like the
 * backend's `GET /api/health`: a FLAT body, `{status, timestamp, commit,
 * branch, env}`, with no `data` envelope.
 *
 * It used to go through `api.get`, which returns `response.data.data`, so the
 * caller always received `undefined` and the sidebar's API indicator read a
 * healthy API as "unreachable" on every deployment.
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { AddressInfo } from "node:net";

let server: Server;
let systemService: typeof import("./system.service").systemService;

before(async () => {
  server = createServer((req, res) => {
    res.setHeader("Content-Type", "application/json");
    if (req.url === "/api/health") {
      return res.end(
        JSON.stringify({
          status: "ok",
          timestamp: "2026-09-30T14:00:00+08:00",
          commit: "d5bf283",
          branch: "development",
          env: "staging",
        }),
      );
    }
    res.statusCode = 404;
    res.end("{}");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  process.env.NEXT_PUBLIC_API_URL = `http://127.0.0.1:${port}/api`;
  systemService = (await import("./system.service")).systemService;
});

after(() => {
  server?.close();
});

test("reads the flat health body, so a healthy API reports ok", async () => {
  const health = await systemService.health();
  assert.equal(health?.status, "ok");
  assert.equal(health?.commit, "d5bf283");
});
