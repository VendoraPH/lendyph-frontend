import type { GCashParty } from "@/types";

/**
 * Turns a party into the identifying half of a create-transaction payload.
 * Members send `borrower_id`, walk-ins send `gcash_non_member_id`; the backend
 * requires exactly one.
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
