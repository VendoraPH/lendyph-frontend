import type { SavingsAccount, SavingsApproval } from "@/types";
import type { SavingsStatusResult } from "@/types/savings-servicing";

/** The server's sentence when it sends none (backend S4's own words). */
export const REACTIVATION_SENT_TEXT =
  "Reactivation sent for approval. The account stays dormant until a checker approves it.";

function approvalOf(data: unknown): SavingsApproval | null {
  if (typeof data !== "object" || data === null || !("approval" in data)) return null;
  const approval = (data as { approval: unknown }).approval;
  return typeof approval === "object" && approval !== null && "id" in approval ? (approval as SavingsApproval) : null;
}

/**
 * Reads `POST /savings/accounts/{id}/status` (gap round S4). Freezing and
 * unfreezing answer 200 with the account. Reactivating a dormant account
 * answers 202 with `{approval}` and a `message`: nothing has changed yet, and
 * the account stays dormant until a checker approves it. A 202 without an
 * approval is refused rather than shown as done.
 */
export function readStatusChange(status: number, body: unknown): SavingsStatusResult {
  const envelope = (typeof body === "object" && body !== null ? body : {}) as { data?: unknown; message?: unknown };
  if (status === 202) {
    const approval = approvalOf(envelope.data);
    if (!approval) throw new Error("The server sent the request for approval without saying which one.");
    const message = typeof envelope.message === "string" && envelope.message.trim() !== "" ? envelope.message : null;
    return { kind: "sent_for_approval", approval, message };
  }
  return { kind: "changed", account: envelope.data as SavingsAccount };
}
