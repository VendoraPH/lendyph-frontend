/**
 * A registration's code as the Registrations list shows it, and as anything
 * else naming a registration must: PEND-0013 while pending, REJ-0013 once
 * rejected, from the record's id (at least four digits). A registration isn't a
 * member yet, so it never reads by its BRW- member code. Pure, so it runs under
 * `tsx --test`.
 */

/** The two registration statuses that get a tab of their own. */
export type RegistrationTabStatus = "pending" | "rejected";

const CODE_PREFIX: Record<RegistrationTabStatus, string> = {
  pending: "PEND",
  rejected: "REJ",
};

export function registrationCode(status: RegistrationTabStatus, id: number): string {
  return `${CODE_PREFIX[status]}-${String(id).padStart(4, "0")}`;
}
