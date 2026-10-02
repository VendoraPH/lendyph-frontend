import { borrowerParty, nonMemberParty } from "@/lib/gcash-party";
import type { Borrower, GCashNonMember, GCashParty } from "@/types";

/** What a picker needs about one selectable party, already flattened. */
export interface GCashPartyOption {
  party: GCashParty;
  /** Second line in the list row — member code, or the presented ID. */
  hint: string | null;
  /** Shown in the dialog's read-only Number field. */
  contactNumber: string | null;
  /**
   * The walk-in record behind the row, so the selected walk-in can be edited
   * without another request. Null for members.
   */
  nonMember: GCashNonMember | null;
}

/** Set only when a drain gave up with pages outstanding. Null means complete. */
export interface GCashPartyShortfall {
  shown: number;
  total: number | null;
}

export interface GCashPartyListState {
  options: GCashPartyOption[];
  shortfall: GCashPartyShortfall | null;
}

export const EMPTY_PARTY_LIST: GCashPartyListState = {
  options: [],
  shortfall: null,
};

export function memberOption(borrower: Borrower): GCashPartyOption {
  return {
    party: borrowerParty(borrower),
    hint: borrower.borrower_code ?? null,
    contactNumber: borrower.contact_number ?? null,
    nonMember: null,
  };
}

export function walkInOption(nonMember: GCashNonMember): GCashPartyOption {
  return {
    party: nonMemberParty(nonMember),
    hint: nonMember.id_type
      ? `${nonMember.id_type} · ${nonMember.id_number}`
      : null,
    contactNumber: nonMember.mobile_number ?? null,
    nonMember,
  };
}

/**
 * The cmdk item value for a row: kind + id, which no two rows share.
 *
 * cmdk highlights by value, so rows that shared one — two walk-ins with the
 * same name, mobile and ID number but a different ID type, which the old
 * search-text value could not tell apart — lit up together. The server does
 * the searching now, so the value no longer has to carry the searchable text.
 */
export function partyOptionValue(option: GCashPartyOption): string {
  return `${option.party.kind}-${option.party.id}`;
}

/** Same person, by kind and id: a member and a walk-in can share an id. */
export function isSameParty(
  a: GCashParty | null | undefined,
  b: GCashParty | null | undefined,
): boolean {
  return Boolean(a && b && a.kind === b.kind && a.id === b.id);
}

/** The tag on each picker row, so members and walk-ins can't be mistaken. */
export function partyKindLabel(party: GCashParty): "Member" | "Walk-in" {
  return party.kind === "member" ? "Member" : "Walk-in";
}

/**
 * The "showing X of Y" figure for members and walk-ins shown in one list.
 *
 * A list that came back whole has no shortfall, and its total is simply how
 * many rows it has. Reading "no shortfall" as "total unknown" blanked the
 * figure whenever only one of the two lists was cut off. The total is unknown
 * only when a cut-off list itself carried none.
 */
export function combineShortfalls(
  members: GCashPartyListState,
  nonMembers: GCashPartyListState,
): GCashPartyShortfall | null {
  if (!members.shortfall && !nonMembers.shortfall) return null;
  const counts = [members, nonMembers].map((list) =>
    list.shortfall ?? {
      shown: list.options.length,
      total: list.options.length,
    },
  );
  return {
    shown: counts.reduce((sum, c) => sum + c.shown, 0),
    total: counts.every((c) => c.total != null)
      ? counts.reduce((sum, c) => sum + (c.total ?? 0), 0)
      : null,
  };
}
