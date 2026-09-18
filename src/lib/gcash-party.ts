import type { Borrower, GCashNonMember, GCashParty } from "@/types";

/**
 * Turns a party into the identifying half of a create-transaction payload.
 * Members send `borrower_id`, walk-ins send `gcash_non_member_id`; the backend
 * requires exactly one.
 *
 * `StoreGCashTransactionRequest` pairs the two with `required_without` and then
 * rejects sending BOTH in its `after()` hook, so this must stay an either/or
 * rather than an object with one key left undefined.
 */
export function gcashPartyPayload(
  party: GCashParty,
): { borrower_id: number } | { gcash_non_member_id: number } {
  return party.kind === "member"
    ? { borrower_id: party.id }
    : { gcash_non_member_id: party.id };
}

/** "member" / "non-member" — used in dialog copy so it reads right for both. */
export function gcashPartyNoun(party: GCashParty): string {
  return party.kind === "member" ? "member" : "non-member";
}

/** Secondary identifier under the name: member code, or mobile for walk-ins. */
export function gcashPartySubtitle(party: GCashParty): string | null {
  return party.kind === "member"
    ? (party.borrower_code ?? null)
    : (party.mobile_number ?? null);
}

/**
 * A member row as a party.
 *
 * Every screen that offers Cash In / Cash Out for a member was building this
 * literal by hand, and `full_name` / `borrower_code` are both nullable on
 * `Borrower` but not on `GCashParty` — so each of those call sites had to
 * remember the same two fallbacks. One place to get it wrong instead of four.
 */
export function borrowerParty(borrower: Borrower): GCashParty {
  return {
    kind: "member",
    id: borrower.id,
    full_name: borrower.full_name ?? "",
    borrower_code: borrower.borrower_code ?? undefined,
  };
}

/** A walk-in row as a party. The counterpart to `borrowerParty`. */
export function nonMemberParty(nonMember: GCashNonMember): GCashParty {
  return {
    kind: "non_member",
    id: nonMember.id,
    full_name: nonMember.full_name,
    mobile_number: nonMember.mobile_number,
  };
}
