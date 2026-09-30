/**
 * The loan page's one "load + enrich" path, pinned at the wire.
 *
 * Every read of the loan on that page goes through `loadLoan`: the first load
 * and the re-read after each action. Before, only the first load filled in the
 * co-makers, and the re-read after a payment skipped the product-name lookup
 * too, so both could vanish from the page after an action.
 *
 * WHAT THIS PROVES: which requests the loader makes for each shape of
 * `GET /loans/{id}` payload, and what it hands back.
 * WHAT IT DOES NOT PROVE: that the page calls it. That is the page's job, and
 * there is no DOM in this suite.
 */
import { test, before, after, beforeEach, describe } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { AddressInfo } from "node:net";
import type { Loan } from "@/types/loan";

/** A status and body to answer with, or DROP to close the connection unanswered. */
type Reply = [status: number, body: unknown] | typeof DROP;
const DROP = "drop";

let server: Server;
let routes: Record<string, Reply> = {};
const seen: string[] = [];
let loadLoan: typeof import("./load-loan").loadLoan;
let loanLoadFailure: typeof import("./load-loan").loanLoadFailure;

const ok = (data: unknown): Reply => [200, { success: true, data }];
const missing: Reply = [404, { message: "Not found." }];

before(async () => {
  server = createServer((req, res) => {
    const path = new URL(req.url ?? "/", "http://127.0.0.1").pathname.replace(/^\/api/, "");
    const key = `${req.method} ${path}`;
    seen.push(key);
    const reply = routes[key] ?? missing;
    if (reply === DROP) {
      req.socket.destroy();
      return;
    }
    const [status, body] = reply;
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(body));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  // Outside the browser the client calls NEXT_PUBLIC_API_URL directly.
  process.env.NEXT_PUBLIC_API_URL = `http://127.0.0.1:${port}/api`;
  ({ loadLoan, loanLoadFailure } = await import("./load-loan"));
});

after(() => {
  server?.close();
});

beforeEach(() => {
  routes = {};
  seen.length = 0;
});

/** The fields of a `GET /loans/{id}` payload this loader reads. */
function detail(extra: Partial<Loan> & Record<string, unknown>) {
  return {
    id: 7,
    status: "released",
    borrower_id: 3,
    borrower: { id: 3, full_name: "Ana Cruz" },
    loan_product: { id: 5, name: "Salary Loan" },
    co_makers: [{ id: 11, full_name: "Ben Santos" }],
    ...extra,
  };
}

describe("loadLoan", () => {
  test("a complete payload costs one request and comes back as sent", async () => {
    routes["GET /loans/7"] = ok(detail({}));

    const loan = await loadLoan(7, null);

    assert.deepEqual(seen, ["GET /loans/7"]);
    assert.deepEqual(loan.co_makers, [{ id: 11, full_name: "Ben Santos" }]);
    assert.equal(loan.loan_product?.name, "Salary Loan");
  });

  test("no linked co-makers: falls back to the borrower's registered ones", async () => {
    routes["GET /loans/7"] = ok(detail({ co_makers: [] }));
    routes["GET /borrowers/3/co-makers"] = ok([
      { id: 21, first_name: "Carla", last_name: "Diaz", relationship_to_borrower: "sibling", address: "Cebu" },
    ]);

    const loan = await loadLoan(7, null);

    assert.deepEqual(seen, ["GET /loans/7", "GET /borrowers/3/co-makers"]);
    assert.deepEqual(loan.co_makers, [
      { id: 21, full_name: "Carla Diaz", address: "Cebu", relationship: "sibling" },
    ]);
  });

  test("explicit co-maker ids are fetched one by one, and a missing one is skipped", async () => {
    routes["GET /loans/7"] = ok(detail({ co_makers: [], co_maker_ids: [31, 32] }));
    routes["GET /co-makers/31"] = ok({ id: 31, full_name: "Dino Reyes", relationship: "friend" });

    const loan = await loadLoan(7, null);

    assert.deepEqual([...seen].sort(), ["GET /co-makers/31", "GET /co-makers/32", "GET /loans/7"]);
    assert.deepEqual(loan.co_makers, [
      { id: 31, full_name: "Dino Reyes", address: undefined, relationship: "friend" },
    ]);
  });

  test("a legacy flat co-maker name is used without asking the borrower's list", async () => {
    routes["GET /loans/7"] = ok(detail({ co_makers: [], co_maker_name: "Elena Lim" }));

    const loan = await loadLoan(7, null);

    assert.deepEqual(seen, ["GET /loans/7"]);
    assert.deepEqual(loan.co_makers, [{ id: 0, full_name: "Elena Lim" }]);
  });

  test("a failed co-maker lookup still returns the loan", async () => {
    routes["GET /loans/7"] = ok(detail({ co_makers: [] }));
    routes["GET /borrowers/3/co-makers"] = [500, { message: "Server Error" }];

    const loan = await loadLoan(7, null);

    assert.equal(loan.id, 7);
    assert.deepEqual(loan.co_makers, []);
  });

  test("a missing product name is looked up by the product id", async () => {
    routes["GET /loans/7"] = ok(detail({ loan_product: undefined, loan_product_id: 5 }));
    routes["GET /loan-products/5"] = ok({ id: 5, name: "Salary Loan" });

    const loan = await loadLoan(7, null);

    assert.deepEqual(seen, ["GET /loans/7", "GET /loan-products/5"]);
    assert.deepEqual(loan.loan_product, { id: 5, name: "Salary Loan" });
  });

  test("when the product lookup fails, the product already on screen is kept", async () => {
    routes["GET /loans/7"] = ok(detail({ loan_product: undefined, loan_product_id: 5 }));
    const onScreen = detail({}) as unknown as Loan;

    const loan = await loadLoan(7, onScreen);

    assert.deepEqual(loan.loan_product, { id: 5, name: "Salary Loan" });
  });

  test("a failed loan read rejects, so the caller can tell it apart from a loaded loan", async () => {
    await assert.rejects(loadLoan(7, null));
    assert.deepEqual(seen, ["GET /loans/7"]);
  });
});

describe("loanLoadFailure", () => {
  /** The error a `GET /loans/7` answered with `reply` rejects `loadLoan` with. */
  async function failureFor(reply: Reply): Promise<unknown> {
    routes["GET /loans/7"] = reply;
    try {
      await loadLoan(7, null);
    } catch (err) {
      return err;
    }
    throw new Error("loadLoan resolved; expected it to reject");
  }

  test("a 404 is a loan that does not exist", async () => {
    assert.equal(loanLoadFailure(await failureFor([404, { message: "Not found." }])), "not_found");
  });

  test("a rate limit is a failed load, never a missing loan", async () => {
    // What staging showed as "Loan Not Found".
    assert.equal(loanLoadFailure(await failureFor([429, { message: "Too Many Attempts." }])), "failed");
  });

  test("server errors are failed loads", async () => {
    for (const status of [500, 502, 503]) {
      assert.equal(
        loanLoadFailure(await failureFor([status, { message: "Server Error" }])),
        "failed",
        String(status),
      );
    }
  });

  test("auth refusals are failed loads, not missing loans", async () => {
    for (const status of [401, 403, 423]) {
      assert.equal(loanLoadFailure(await failureFor([status, { message: "No." }])), "failed", String(status));
    }
  });

  test("a connection that drops without an answer is a failed load", async () => {
    assert.equal(loanLoadFailure(await failureFor(DROP)), "failed");
  });

  test("a throw that never reached the network is a failed load", () => {
    assert.equal(loanLoadFailure(new TypeError("Cannot read properties of undefined")), "failed");
    assert.equal(loanLoadFailure(undefined), "failed");
  });
});
