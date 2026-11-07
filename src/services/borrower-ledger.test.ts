/**
 * The member Ledger, pinned at the wire.
 *
 * WHAT THIS PROVES: `borrowerService.ledger(id)` asks GET /borrowers/{id}/ledger
 * and returns the rows and `meta.closing` beside them. `api.get` unwraps `data`
 * and would drop `meta`, which is the Ledger tab's footer.
 * WHAT IT DOES NOT PROVE: the figures; those are the backend's ledger tests.
 */
import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { AddressInfo } from "node:net";

const BODY = {
  data: [
    {
      id: 1,
      date: "2026-11-06",
      description: "Loan released",
      reference: "LN-000078",
      debit: 15000,
      credit: 0,
      balance: 15000,
      loan_id: 78,
      loan_account_number: "LN-000078",
      kind: "release",
      repayment_id: null,
    },
  ],
  meta: { closing: { principal: 15000, interest: 0, penalty: 0, balance: 15000 } },
};

let server: Server;
let borrowerService: typeof import("./borrower.service").borrowerService;
let seen: string | undefined;

before(async () => {
  server = createServer((req, res) => {
    seen = req.url;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(BODY));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  process.env.NEXT_PUBLIC_API_URL = `http://127.0.0.1:${port}/api`;
  ({ borrowerService } = await import("./borrower.service"));
});

after(() => {
  server?.close();
});

describe("borrowerService.ledger", () => {
  test("returns the rows and the server's closing, untouched", async () => {
    assert.deepEqual(await borrowerService.ledger(7), BODY);
    assert.equal(seen, "/api/borrowers/7/ledger");
  });
});
