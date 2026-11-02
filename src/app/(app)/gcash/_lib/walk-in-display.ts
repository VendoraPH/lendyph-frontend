import type { GCashNonMember } from "@/types";

type WalkInIdentity = Pick<
  GCashNonMember,
  "id_type" | "id_number" | "mobile_number"
>;

/**
 * "UMID · 1234-5678", or null for a walk-in saved without an ID. The ID is
 * optional, so either field may be null or blank; a half-filled pair shows
 * what it has instead of "null" or a stray separator.
 */
export function walkInIdLabel(nonMember: WalkInIdentity): string | null {
  const parts = [nonMember.id_type, nonMember.id_number]
    .map((part) => part?.trim() ?? "")
    .filter((part) => part.length > 0);
  return parts.length > 0 ? parts.join(" · ") : null;
}

/** The ID (when there is one) and the mobile number, " · " between them. */
export function walkInDetails(nonMember: WalkInIdentity): string {
  return [walkInIdLabel(nonMember), nonMember.mobile_number?.trim() || null]
    .filter((part): part is string => part !== null)
    .join(" · ");
}
