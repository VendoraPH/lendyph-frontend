// The Release dialog's "Add Co-Maker". Dependency-free, so it runs under
// `tsx --test`.

import type { CreateCoMakerData } from "@/services/co-maker.service";
import type { CoMaker } from "@/types";
import type { LoanCoMaker, LoanStatus } from "@/types/loan";

/**
 * Whether the loan page offers to add a co-maker: only while the loan awaits
 * release, and only to someone who can release it. These are the two things
 * `POST /loans/{id}/co-makers` checks (a 422 past `approved`, a 403 without
 * `loans:release`). A released loan keeps the co-makers it was released with,
 * so the action is hidden rather than disabled.
 */
export function canAddLoanCoMaker(
  status: LoanStatus | undefined,
  canRelease: boolean,
): boolean {
  return canRelease && status === "approved";
}

/**
 * The borrower's registered co-makers the Release dialog can link, in the
 * order the API listed them: active ones not already on the loan. The API
 * refuses the rest with a 422 on `co_maker_id`, so they are not offered.
 */
export function linkableCoMakers(registered: CoMaker[], onLoan: LoanCoMaker[]): CoMaker[] {
  const linked = new Set(onLoan.map((cm) => cm.id));
  return registered.filter((cm) => cm.status === "active" && !linked.has(cm.id));
}

/** The new co-maker's fields, as the Release dialog's form holds them. */
export interface NewCoMakerForm {
  first_name: string;
  last_name: string;
  contact_number: string;
  relationship_to_borrower: string;
}

export const EMPTY_NEW_CO_MAKER: NewCoMakerForm = {
  first_name: "",
  last_name: "",
  contact_number: "",
  relationship_to_borrower: "",
};

/**
 * The body that creates the co-maker and links it to the loan: every field
 * trimmed, a blank optional one left out. Null while either name is blank,
 * which is also when the form cannot be submitted.
 */
export function newCoMakerPayload(form: NewCoMakerForm): CreateCoMakerData | null {
  const first_name = form.first_name.trim();
  const last_name = form.last_name.trim();
  if (!first_name || !last_name) return null;
  const contact_number = form.contact_number.trim();
  const relationship_to_borrower = form.relationship_to_borrower.trim();
  return {
    first_name,
    last_name,
    ...(contact_number && { contact_number }),
    ...(relationship_to_borrower && { relationship_to_borrower }),
  };
}
