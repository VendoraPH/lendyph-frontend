import type { SavingsApproval } from "@/types";

/**
 * What a savings money post came back with.
 *
 * Above the first approval tier, a withdrawal, a close, a time-deposit
 * settlement or a pre-termination answers **202 with `{approval}`**: nothing
 * has moved yet, and the request waits in the approvals queue. Below it, the
 * server answers 201 with the record it posted. A reversal request always
 * answers 202.
 */
export type MoneyPostResult<T> =
  | { kind: "posted"; record: T }
  | { kind: "sent_for_approval"; approval: SavingsApproval };

function hasApproval(data: unknown): data is { approval: SavingsApproval } {
  if (typeof data !== "object" || data === null || !("approval" in data)) return false;
  const approval = (data as { approval: unknown }).approval;
  return typeof approval === "object" && approval !== null && "id" in approval;
}

/**
 * Reads a money post's HTTP status and unwrapped `data`. A 202 must carry an
 * approval; a 202 without one is refused rather than shown as posted.
 */
export function readMoneyPost<T>(status: number, data: unknown): MoneyPostResult<T> {
  if (status === 202) {
    if (!hasApproval(data)) throw new Error("The server sent the request for approval without saying which one.");
    return { kind: "sent_for_approval", approval: data.approval };
  }
  return { kind: "posted", record: data as T };
}

/** The toast after a money post: what happened, in words. */
export function moneyPostMessage(result: MoneyPostResult<unknown>, postedText: string): string {
  if (result.kind === "posted") return postedText;
  // A checker is needed for a reason other than the amount (gap round S4: the
  // first money out on the day a deposit reactivated the account): say why.
  const reason = result.approval.check_reason?.trim();
  if (reason) return `Sent for approval. ${reason}`;
  const checkers = result.approval.required_checkers;
  return checkers > 1
    ? `Sent for approval. ${checkers} different approvers must approve it before it posts.`
    : "Sent for approval. It posts once another user approves it.";
}
