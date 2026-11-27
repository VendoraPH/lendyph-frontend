/**
 * The loan page's "Assign / Change" account officer control, pinned at the wire.
 *
 * It used to send `PUT /loans/{id}`. The API refuses that for every loan past
 * for_review, and on a draft UpdateLoanRequest has no `account_officer_id`
 * rule, so the value was dropped while the page said "Account officer updated".
 * The API now has `PATCH /loans/{id}/account-officer`
 * (LoanController::assignAccountOfficer), which works at any status.
 *
 * `PUT /loans/{id}` has since learned to save the officer too, and create,
 * update and restructure all refuse an inactive one. Create and restructure
 * always send the key, `null` for none. An edit sends it only when the officer
 * changed (`editedAccountOfficer`), so an unchanged officer who has since been
 * deactivated does not 422 an edit of something else.
 *
 * WHAT THIS PROVES: the service calls that endpoint with that body, hands back
 * what the server saved, and lets a validation failure reach the caller so the
 * page can show the server's message. For the edit form: an unchanged officer
 * is left off the body, a changed one is sent, a cleared one goes out as `null`.
 * For every form: an inactive officer comes back as the message `notifyError`
 * shows.
 * WHAT IT DOES NOT PROVE: the controller itself. That is LoanAccountOfficerTest
 * in the backend repo.
 */
import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { AddressInfo } from "node:net";
import { getErrorMessage } from "@/lib/api-error";
import { editedAccountOfficer } from "@/lib/loan-account-officer";

interface Seen {
  method: string;
  path: string;
  body: unknown;
}

/** A user the stub treats as deactivated. */
const INACTIVE_OFFICER = 13;
const INACTIVE_MESSAGE = "Choose an active user as the account officer.";

let server: Server;
const seen: Seen[] = [];
let loanService: typeof import("./loan.service").loanService;

before(async () => {
  server = createServer((req, res) => {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      const path = new URL(req.url ?? "/", "http://127.0.0.1").pathname.replace(/^\/api/, "");
      const body = raw ? JSON.parse(raw) : null;
      seen.push({ method: req.method ?? "", path, body });
      res.setHeader("Content-Type", "application/json");

      const officerId = (body as { account_officer_id?: number | null } | null)?.account_officer_id;
      const inactive = () => {
        res.statusCode = 422;
        return res.end(
          JSON.stringify({ message: INACTIVE_MESSAGE, errors: { account_officer_id: [INACTIVE_MESSAGE] } }),
        );
      };
      // The forms' routes: store, update and restructure, each with an
      // active-user rule on a nullable `account_officer_id`.
      if (["POST /loans", "PUT /loans/7", "POST /loans/7/restructure"].includes(`${req.method} ${path}`)) {
        if (officerId === INACTIVE_OFFICER) return inactive();
        return res.end(JSON.stringify({ data: { id: 8, account_officer_id: officerId ?? null } }));
      }
      if (req.method === "PATCH" && path === "/loans/7/account-officer" && officerId === 4) {
        return res.end(
          JSON.stringify({
            data: {
              id: 7,
              status: "released",
              account_officer_id: 4,
              account_officer: { id: 4, full_name: "Pedro Reyes" },
            },
          }),
        );
      }
      if (req.method === "PATCH" && path === "/loans/7/account-officer") {
        res.statusCode = 422;
        return res.end(
          JSON.stringify({
            message: "Choose an active user as the account officer.",
            errors: { account_officer_id: ["Choose an active user as the account officer."] },
          }),
        );
      }
      res.statusCode = 404;
      res.end(JSON.stringify({ message: "not stubbed" }));
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

describe("loanService.assignAccountOfficer", () => {
  test("PATCHes the dedicated endpoint, never the generic loan update", async () => {
    seen.length = 0;
    await loanService.assignAccountOfficer(7, 4);

    assert.deepEqual(seen, [
      { method: "PATCH", path: "/loans/7/account-officer", body: { account_officer_id: 4 } },
    ]);
  });

  test("returns the loan as the server saved it", async () => {
    const saved = (await loanService.assignAccountOfficer(7, 4)) as unknown as Record<string, unknown>;

    assert.equal(saved.account_officer_id, 4);
    assert.deepEqual(saved.account_officer, { id: 4, full_name: "Pedro Reyes" });
  });

  test("rejects with the server's 422 so the page can show its message", async () => {
    await assert.rejects(loanService.assignAccountOfficer(7, 999), (err: unknown) => {
      const response = (err as { response?: { status?: number; data?: { message?: string } } }).response;
      assert.equal(response?.status, 422);
      assert.equal(response?.data?.message, "Choose an active user as the account officer.");
      return true;
    });
  });
});

describe("the loan forms' account_officer_id", () => {
  const loaded = { id: INACTIVE_OFFICER, full_name: "Deactivated Since" };

  test("an edit that leaves the officer alone omits the key", async () => {
    seen.length = 0;
    await loanService.update(7, { purpose: "Tuition", ...editedAccountOfficer(loaded, loaded) });

    assert.deepEqual(seen, [
      { method: "PUT", path: "/loans/7", body: { purpose: "Tuition" } },
    ]);
  });

  test("an edit that changes the officer sends the new id", async () => {
    seen.length = 0;
    await loanService.update(7, editedAccountOfficer({ id: 4, full_name: "Pedro Reyes" }, loaded));

    assert.deepEqual(seen, [
      { method: "PUT", path: "/loans/7", body: { account_officer_id: 4 } },
    ]);
  });

  test("an edit that clears the officer sends null, not an absent key", async () => {
    seen.length = 0;
    await loanService.update(7, editedAccountOfficer(null, loaded));

    assert.deepEqual(seen, [
      { method: "PUT", path: "/loans/7", body: { account_officer_id: null } },
    ]);
  });

  test("an edit of a loan with no officer, still none, omits the key", () => {
    assert.deepEqual(editedAccountOfficer(null, null), {});
  });

  test("an inactive officer's 422 reaches the toast in the server's words", async () => {
    const sends = [
      () => loanService.create({ account_officer_id: INACTIVE_OFFICER }),
      () => loanService.update(7, { account_officer_id: INACTIVE_OFFICER }),
      () => loanService.restructure(7, { account_officer_id: INACTIVE_OFFICER }),
    ];
    for (const send of sends) {
      await assert.rejects(send(), (err: unknown) => {
        assert.equal(getErrorMessage(err, "fallback"), INACTIVE_MESSAGE);
        return true;
      });
    }
  });
});
