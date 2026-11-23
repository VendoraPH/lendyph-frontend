import type { TimeDeposit } from "@/types/savings";

/**
 * The Terms card's Reference row: the placement's payment reference exactly as
 * the server sent it (the server's TD-… number for a cash placement, once it
 * numbers them). No reference, or a blank one, adds no row.
 */
export function referenceRow(td: Pick<TimeDeposit, "reference">): [string, string] | null {
  const reference = td.reference?.trim();
  return reference ? ["Reference", reference] : null;
}
