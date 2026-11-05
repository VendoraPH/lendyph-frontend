import type { MemberOption } from "@/hooks/use-member-search";

/**
 * The member a collateral form opens with: an edit's own, or a new collateral's
 * from the `?borrower_id=` link. `GET /collaterals/{id}` names the member by id
 * only, so the form reads the name separately.
 */
export function knownMemberId(
  initial: { borrower_id: number } | undefined,
  presetBorrowerId: string | null,
): number | null {
  if (initial) return initial.borrower_id;
  const preset = Number(presetBorrowerId);
  return Number.isInteger(preset) && preset > 0 ? preset : null;
}

/**
 * Stands in until the name is read, or for a role that can't read it. A chosen
 * member must never look unchosen: saving still sends the id.
 */
export function memberPlaceholderOption(id: number): MemberOption {
  return { id, full_name: `Member #${id}` };
}
