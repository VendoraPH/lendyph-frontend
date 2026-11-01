/**
 * The Extend dialog's preview, pinned at the wire.
 *
 * WHAT THIS PROVES: the option is sent as `interest_option` on
 * `GET /loans/{id}/extension-preview`, the `data` envelope is unwrapped with
 * every figure as the server sent it, and a 422 reaches the caller with the
 * server's message.
 * WHAT IT DOES NOT PROVE: the figures; those are the backend's preview tests.
 */
import { test, before, after, beforeEach, describe } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { AddressInfo } from "node:net";
import { getErrorMessage, httpStatusOf } from "@/lib/api-error";
import type { LoanExtensionPreview } from "@/types";

const PREVIEW: LoanExtensionPreview = {
  interest_option: "defer",
  collect_now: { amount: 0, penalty_part: 0, interest_part: 0 },
  carry_principal: 70000,
  carry_interest: 3000,
  fresh_interest: 3000,
  new_interest_due: 6000,
  new_total_due: 76000,
  new_due_date: "2027-01-31",
};

type Reply = [status: number, body: unknown];

let server: Server;
const seen: { method: string; path: string; query: string }[] = [];
let reply: Reply = [200, { data: PREVIEW }];
let loanService: typeof import("./loan.service").loanService;

before(async () => {
  server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const path = url.pathname.replace(/^\/api/, "");
    seen.push({ method: req.method ?? "", path, query: url.search });
    const [status, body] =
      req.method === "GET" && path === "/loans/7/extension-preview" ? reply : [404, { message: "not stubbed" }];
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(body));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  // Outside the browser the client calls NEXT_PUBLIC_API_URL directly.
  process.env.NEXT_PUBLIC_API_URL = `http://127.0.0.1:${port}/api`;
  ({ loanService } = await import("./loan.service"));
});

after(() => {
  server?.close();
});

beforeEach(() => {
  seen.length = 0;
  reply = [200, { data: PREVIEW }];
});

describe("loanService.extensionPreview", () => {
  test("GETs the preview for the chosen interest option", async () => {
    await loanService.extensionPreview(7, "defer");
    await loanService.extensionPreview(7, "pay");
    assert.deepEqual(seen, [
      { method: "GET", path: "/loans/7/extension-preview", query: "?interest_option=defer" },
      { method: "GET", path: "/loans/7/extension-preview", query: "?interest_option=pay" },
    ]);
  });

  test("returns the server's figures, unwrapped and untouched", async () => {
    assert.deepEqual(await loanService.extensionPreview(7, "defer"), PREVIEW);
  });

  test("lets a 422 reach the caller with the server's message", async () => {
    reply = [422, { message: "This loan cannot be extended." }];
    await assert.rejects(loanService.extensionPreview(7, "pay"), (err: unknown) => {
      assert.equal(httpStatusOf(err), 422);
      assert.equal(getErrorMessage(err, "fallback"), "This loan cannot be extended.");
      return true;
    });
  });
});
