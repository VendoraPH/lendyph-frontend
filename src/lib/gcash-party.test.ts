/**
 * The either/or that decides whose transaction this is.
 *
 * `StoreGCashTransactionRequest` pairs `borrower_id` and `gcash_non_member_id`
 * with `required_without`, then rejects sending BOTH in its `after()` hook. So
 * "a member" and "a walk-in" are not two optional fields on one payload, they
 * are two shapes — and the only thing keeping a caller from hardcoding
 * `borrower_id` and stranding every walk-in is this helper being used.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  borrowerParty,
  gcashPartyNoun,
  gcashPartyPayload,
  gcashPartySubtitle,
  nonMemberParty,
} from "./gcash-party";
import type { Borrower, GCashNonMember } from "@/types";

const member = borrowerParty({
  id: 42,
  borrower_code: "M-0042",
  full_name: "Maria Dela Cruz",
  contact_number: "09171234567",
} as Borrower);

const walkIn = nonMemberParty({
  id: 42,
  full_name: "Juan Santos",
  mobile_number: "09981112222",
  id_type: "UMID",
  id_number: "1234-567",
} as GCashNonMember);

describe("gcashPartyPayload", () => {
  test("a member sends borrower_id and nothing else", () => {
    assert.deepEqual(gcashPartyPayload(member), { borrower_id: 42 });
  });

  test("a walk-in sends gcash_non_member_id and nothing else", () => {
    assert.deepEqual(gcashPartyPayload(walkIn), { gcash_non_member_id: 42 });
  });

  test("never both keys — the backend 422s on that, it does not pick one", () => {
    for (const party of [member, walkIn]) {
      const payload = gcashPartyPayload(party);
      assert.equal(Object.keys(payload).length, 1);
    }
  });

  test("the two ids are independent namespaces, so the key is the whole answer", () => {
    // Same numeric id, opposite parties: anything that reads the id without
    // the key bills a member for a walk-in's cash.
    assert.equal(member.id, walkIn.id);
    assert.notDeepEqual(gcashPartyPayload(member), gcashPartyPayload(walkIn));
  });
});

describe("party adapters", () => {
  test("borrowerParty fills the fields GCashParty requires but Borrower may not have", () => {
    const sparse = borrowerParty({ id: 7 } as Borrower);
    assert.equal(sparse.kind, "member");
    assert.equal(sparse.full_name, "", "never undefined — dialogs render it raw");
    assert.equal(
      sparse.kind === "member" ? sparse.borrower_code : "unreachable",
      undefined,
    );
  });

  test("nonMemberParty carries the mobile number, which is the walk-in's only handle", () => {
    assert.equal(walkIn.kind, "non_member");
    assert.equal(walkIn.full_name, "Juan Santos");
    assert.equal(gcashPartySubtitle(walkIn), "09981112222");
  });

  test("subtitle and noun follow the kind, so dialog copy reads right for both", () => {
    assert.equal(gcashPartySubtitle(member), "M-0042");
    assert.equal(gcashPartyNoun(member), "member");
    assert.equal(gcashPartyNoun(walkIn), "non-member");
  });
});
