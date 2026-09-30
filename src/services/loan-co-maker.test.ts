/**
 * The Release dialog's "Add Co-Maker", pinned at the wire.
 *
 * It used to send `POST /borrowers/{id}/co-makers`, which creates a co-maker
 * on the borrower and links it to no loan, and then appended the result to the
 * page's copy of the loan, so the dialog showed a co-maker the loan did not
 * have. It now sends `POST /loans/{id}/co-makers`, which links it.
 *
 * The borrower page reads the same links from both sides: each loan's
 * `co_makers` off `GET /loans`, and each co-maker's `loans` off
 * `GET /borrowers/{id}/co-makers`. It used to match them up by a `loan_id` on
 * the co-maker that the API never sent, so no link was ever shown.
 *
 * WHAT THIS PROVES: `loanService.addCoMaker` posts to the loan's co-makers with
 * the body it was given (a new co-maker's details, or an existing co-maker's
 * id), hands back the linked co-maker, and lets a refusal reach the caller as
 * the message `notifyError` shows. And the borrower page's two reads hand back
 * those link fields as the API sent them.
 * WHAT IT DOES NOT PROVE: the controller itself, which the backend's tests
 * cover, or what the page renders from them (no DOM in this suite).
 */
import { test, before, after, beforeEach, describe } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { AddressInfo } from "node:net";
import { getErrorMessage } from "@/lib/api-error";

interface Seen {
  method: string;
  path: string;
  body: unknown;
}

type Reply = [status: number, body: unknown];

const NOT_AWAITING_RELEASE = "Co-makers can only be added while the loan is awaiting release.";

let server: Server;
let routes: Record<string, Reply> = {};
const seen: Seen[] = [];
let loanService: typeof import("./loan.service").loanService;
let coMakerService: typeof import("./co-maker.service").coMakerService;

before(async () => {
  server = createServer((req, res) => {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      const path = new URL(req.url ?? "/", "http://127.0.0.1").pathname.replace(/^\/api/, "");
      seen.push({ method: req.method ?? "", path, body: raw ? JSON.parse(raw) : null });
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
  ({ coMakerService } = await import("./co-maker.service"));
});

after(() => {
  server?.close();
});

beforeEach(() => {
  routes = {};
  seen.length = 0;
});

describe("loanService.addCoMaker", () => {
  const linked = {
    id: 21,
    borrower_id: 3,
    full_name: "Carla Diaz",
    relationship_to_borrower: "Sibling",
    added_by: 4,
    added_at: "2026-09-30T02:15:00Z",
  };

  test("posts a new co-maker's details to the loan, never to the borrower", async () => {
    routes["POST /loans/7/co-makers"] = [201, { message: "Co-maker added.", data: linked }];

    await loanService.addCoMaker(7, { first_name: "Carla", last_name: "Diaz", relationship_to_borrower: "Sibling" });

    assert.deepEqual(seen, [
      {
        method: "POST",
        path: "/loans/7/co-makers",
        body: { first_name: "Carla", last_name: "Diaz", relationship_to_borrower: "Sibling" },
      },
    ]);
  });

  test("links an existing co-maker by its id", async () => {
    routes["POST /loans/7/co-makers"] = [201, { message: "Co-maker added.", data: linked }];

    await loanService.addCoMaker(7, { co_maker_id: 21 });

    assert.deepEqual(seen, [{ method: "POST", path: "/loans/7/co-makers", body: { co_maker_id: 21 } }]);
  });

  test("returns the linked co-maker", async () => {
    routes["POST /loans/7/co-makers"] = [201, { message: "Co-maker added.", data: linked }];

    assert.deepEqual(await loanService.addCoMaker(7, { co_maker_id: 21 }), linked);
  });

  test("a loan past approval is refused, in the server's words", async () => {
    routes["POST /loans/7/co-makers"] = [
      422,
      { message: NOT_AWAITING_RELEASE, errors: { status: [NOT_AWAITING_RELEASE] } },
    ];

    await assert.rejects(loanService.addCoMaker(7, { co_maker_id: 21 }), (err: unknown) => {
      assert.equal(getErrorMessage(err, "fallback"), NOT_AWAITING_RELEASE);
      return true;
    });
  });

  test("a user without loans:release is told so, not shown the framework's text", async () => {
    routes["POST /loans/7/co-makers"] = [403, { message: "This action is unauthorized." }];

    await assert.rejects(loanService.addCoMaker(7, { co_maker_id: 21 }), (err: unknown) => {
      assert.equal(getErrorMessage(err, "fallback"), "You don't have permission to do that.");
      return true;
    });
  });
});

describe("the borrower page's co-maker links", () => {
  test("its loan list keeps each row's co_makers", async () => {
    const coMakers = [{ id: 21, full_name: "Carla Diaz", relationship_to_borrower: "sibling" }];
    routes["GET /loans"] = [
      200,
      { data: [{ id: 7, co_makers: coMakers }], meta: { current_page: 1, last_page: 1, total: 1 } },
    ];

    const { rows } = await loanService.listAll({ borrower_id: 3 });

    assert.deepEqual(seen.map((r) => `${r.method} ${r.path}`), ["GET /loans"]);
    assert.deepEqual(rows[0]?.co_makers, coMakers);
  });

  test("its co-maker list keeps each co-maker's loans", async () => {
    const loans = [
      { id: 7, application_number: "APP-0007", loan_account_number: "LN-0007", status: "current" },
      { id: 9, application_number: "APP-0009", loan_account_number: null, status: "approved" },
    ];
    routes["GET /borrowers/3/co-makers"] = [200, { data: [{ id: 21, full_name: "Carla Diaz", loans }] }];

    const coMakers = await coMakerService.list(3);

    assert.deepEqual(coMakers[0]?.loans, loans);
  });
});
