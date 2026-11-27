/**
 * The Release dialog's two calls, pinned at the wire.
 *
 * The dialog used to release without asking `GET /loans/{id}/release-preview`
 * what the release would withhold, so it quoted a net that left out every fee
 * configured in Settings, and it never sent the preview's `fee_fingerprint`,
 * so a fee changed while the dialog was open went unnoticed.
 *
 * WHAT THIS PROVES: `loanService.releasePreview` reads the preview and hands it
 * back unwrapped; asked about insurance, it sends the insurance as query
 * params and hands back the server's premium and after-insurance figures
 * untouched; its 422 (fees over the principal) reaches the caller as the
 * server's message; `loanService.release` sends the fingerprint with the
 * insurance; and a 409 (fees changed since the preview) reaches the caller as
 * a 409 carrying the server's message.
 * WHAT IT DOES NOT PROVE: the controller, which the backend's tests cover, or
 * that the dialog re-reads the preview after a 409 (no DOM in this suite).
 */
import { test, before, after, beforeEach, describe } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { AddressInfo } from "node:net";
import { getErrorMessage, httpStatusOf } from "@/lib/api-error";

interface Seen {
  method: string;
  path: string;
  body: unknown;
}

type Reply = [status: number, body: unknown];

let server: Server;
let routes: Record<string, Reply> = {};
const seen: Seen[] = [];
const queries: string[] = [];
let loanService: typeof import("./loan.service").loanService;

before(async () => {
  server = createServer((req, res) => {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      const url = new URL(req.url ?? "/", "http://127.0.0.1");
      const path = url.pathname.replace(/^\/api/, "");
      seen.push({ method: req.method ?? "", path, body: raw ? JSON.parse(raw) : null });
      queries.push(url.search);
      const [status, body] = routes[`${req.method} ${path}`] ?? [404, { message: "not stubbed" }];
      res.statusCode = status;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(body));
    });
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
  routes = {};
  seen.length = 0;
  queries.length = 0;
});

/** LoanReleaseFeeService::preview(), as the controller wraps it. */
const PREVIEW = {
  deductions: [
    { name: "Processing Fee", amount: 300, type: "percentage", original_value: 2 },
    { name: "Service Fee", amount: 150, type: "fixed", original_value: 150 },
    { name: "Documentary Stamp", amount: 500, type: "fixed", original_value: 500, fee_id: 3 },
    { name: "Notarial Fee", amount: 300, type: "fixed", original_value: 300, fee_id: 4 },
  ],
  total_deductions: "1250.00",
  net_proceeds: "13750.00",
  fee_fingerprint: "9f2c1e",
  overlap_warnings: [],
};

describe("loanService.releasePreview", () => {
  test("reads the loan's release preview and hands it back unwrapped", async () => {
    routes["GET /loans/7/release-preview"] = [200, { data: PREVIEW }];

    const preview = await loanService.releasePreview(7);

    assert.deepEqual(seen.map((r) => `${r.method} ${r.path}`), ["GET /loans/7/release-preview"]);
    assert.deepEqual(preview, PREVIEW);
  });

  test("without insurance it sends no query", async () => {
    routes["GET /loans/7/release-preview"] = [200, { data: PREVIEW }];

    await loanService.releasePreview(7, null);

    assert.deepEqual(queries, [""]);
  });

  test("asked about insurance, it sends it as query params and returns the server's figures", async () => {
    const answer = {
      ...PREVIEW,
      insurance: { premium_amount: "300.00", collected: "120.00", partial_amount: "120.00", remaining_balance: "180.00" },
      total_deductions_after_insurance: "1370.00",
      net_proceeds_after_insurance: "13630.00",
      exceeds_net_proceeds: false,
    };
    routes["GET /loans/7/release-preview"] = [200, { data: answer }];

    const preview = await loanService.releasePreview(7, {
      insurance_premium_percentage: 2,
      insurance_payment_type: "partial",
      insurance_partial_amount: 120.5,
    });

    assert.deepEqual(
      Object.fromEntries(new URLSearchParams(queries[0])),
      { insurance_premium_percentage: "2", insurance_payment_type: "partial", insurance_partial_amount: "120.5" },
    );
    assert.deepEqual(preview, answer);
  });

  test("a partial amount above the premium is refused in the server's words", async () => {
    const message = "The insurance partial amount may not be greater than the premium.";
    routes["GET /loans/7/release-preview"] = [422, { message, errors: { insurance_partial_amount: [message] } }];

    await assert.rejects(
      loanService.releasePreview(7, {
        insurance_premium_percentage: 2,
        insurance_payment_type: "partial",
        insurance_partial_amount: 500,
      }),
      (err: unknown) => {
        assert.equal(httpStatusOf(err), 422);
        assert.equal(getErrorMessage(err, "fallback"), message);
        return true;
      },
    );
  });

  test("fees over the principal are refused in the server's words", async () => {
    const message =
      "Configured fees of ₱15,500.00 bring total deductions to ₱15,950.00, which exceeds the ₱15,000.00 principal. Review the fee rules in Settings before releasing this loan.";
    routes["GET /loans/7/release-preview"] = [422, { message, errors: { fees: [message] } }];

    await assert.rejects(loanService.releasePreview(7), (err: unknown) => {
      assert.equal(getErrorMessage(err, "fallback"), message);
      return true;
    });
  });
});

describe("loanService.release", () => {
  const body = {
    insurance_premium_percentage: 2,
    insurance_premium_amount: 300,
    insurance_payment_type: "full" as const,
    insurance_partial_amount: 0,
    insurance_remaining_balance: 0,
    fee_fingerprint: PREVIEW.fee_fingerprint,
  };

  test("sends the preview's fee_fingerprint with the insurance", async () => {
    routes["PATCH /loans/7/release"] = [200, { message: "Loan released successfully.", data: { id: 7 } }];

    await loanService.release(7, body);

    assert.deepEqual(seen, [{ method: "PATCH", path: "/loans/7/release", body }]);
  });

  test("fees changed since the preview: a 409 with the server's message", async () => {
    const message =
      "The fee configuration changed after this release was previewed. Reload the release preview and confirm the new figures before disbursing.";
    routes["PATCH /loans/7/release"] = [
      409,
      {
        message,
        errors: { fee_fingerprint: ["The fee configuration changed after this release was previewed."] },
        data: { expected_fee_fingerprint: "9f2c1e", current_fee_fingerprint: "a41b07" },
      },
    ];

    await assert.rejects(loanService.release(7, body), (err: unknown) => {
      assert.equal(httpStatusOf(err), 409);
      assert.equal(getErrorMessage(err, "fallback"), message);
      return true;
    });
  });
});
