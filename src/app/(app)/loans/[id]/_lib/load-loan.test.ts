/**
 * The loan page's one "load + enrich" path, pinned at the wire.
 *
 * Every read of the loan on that page goes through `loadLoan`: the first load
 * and the re-read after each action. Before, the re-read after a payment
 * skipped the product-name lookup, so the product could vanish from the page
 * after an action.
 *
 * The co-makers are the loan's own, as `GET /loans/{id}` lists them. An empty
 * list used to be filled with the borrower's registered co-makers, so a
 * co-maker never linked to the loan was shown as one of its co-makers.
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

type Reply = [status: number, body: unknown];

let server: Server;
let routes: Record<string, Reply> = {};
const seen: string[] = [];
let loadLoan: typeof import("./load-loan").loadLoan;

const ok = (data: unknown): Reply => [200, { success: true, data }];
const missing: Reply = [404, { message: "Not found." }];

before(async () => {
  server = createServer((req, res) => {
    const path = new URL(req.url ?? "/", "http://127.0.0.1").pathname.replace(/^\/api/, "");
    const key = `${req.method} ${path}`;
    seen.push(key);
    const [status, body] = routes[key] ?? missing;
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(body));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  // Outside the browser the client calls NEXT_PUBLIC_API_URL directly.
  process.env.NEXT_PUBLIC_API_URL = `http://127.0.0.1:${port}/api`;
  ({ loadLoan } = await import("./load-loan"));
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

  test("no linked co-makers shows none, even when the borrower has registered ones", async () => {
    routes["GET /loans/7"] = ok(detail({ co_makers: [] }));
    routes["GET /borrowers/3/co-makers"] = ok([
      { id: 21, first_name: "Carla", last_name: "Diaz", relationship_to_borrower: "sibling" },
    ]);

    const loan = await loadLoan(7, null);

    assert.deepEqual(seen, ["GET /loans/7"]);
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
