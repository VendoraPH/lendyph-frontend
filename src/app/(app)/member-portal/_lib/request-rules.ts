import { httpStatusOf } from "@/lib/api-error";
import type {
  PortalDecisionInput,
  PortalMoneyDetails,
  PortalRequestDecision,
  PortalRequestStatus,
  PortalRequestType,
} from "@/types/portal-admin";

/**
 * The requests queue's rules: which decisions a request offers in its status,
 * the body each sends, and what the server's answer means. The server
 * re-checks the status under the request's lock (a stale one is 409) and the
 * amount is never sent: it reads the request's own.
 */

/** Statuses a decision can still move (`RequestDesk::CANCELLABLE`). */
const OPEN: readonly PortalRequestStatus[] = ["submitted", "under_review", "need_info"];

/** The permission each type's decision also needs (`StaffQueue::TYPE_PERMISSIONS`). */
export const TYPE_PERMISSION = {
  profile_update: "borrowers:update",
  savings_withdrawal: "savings:transact",
  savings_opening: "savings:create",
} as const satisfies Record<PortalRequestType, string>;

/** The decisions a request offers, in the order the dialog lists them. */
export function decisionsFor(status: PortalRequestStatus): PortalRequestDecision[] {
  if (!OPEN.includes(status)) return [];
  const offered: PortalRequestDecision[] = [];
  if (status === "submitted" || status === "need_info") offered.push("under_review");
  if (status === "submitted" || status === "under_review") offered.push("need_info");
  offered.push("approve", "reject");
  return offered;
}

export const DECISION_LABELS: Record<PortalRequestDecision, string> = {
  under_review: "Put under review",
  need_info: "Ask the member for more information",
  approve: "Approve",
  reject: "Reject",
};

/** Whether the decision needs a message to the member. */
export function needsMessage(decision: PortalRequestDecision): boolean {
  return decision === "need_info" || decision === "reject";
}

/** Whether approving this type takes money details: a payout or the opening deposit. */
export function moneyDetailsFor(type: PortalRequestType): "payout" | "deposit" | null {
  if (type === "savings_withdrawal") return "payout";
  if (type === "savings_opening") return "deposit";
  return null;
}

export interface DecisionForm {
  decision: PortalRequestDecision;
  message: string;
  money: PortalMoneyDetails;
}

/** Whether the server's 2-decimal amount is above ₱0.00 (read as text; nothing is worked out). */
function aboveZero(amount: string | null | undefined): boolean {
  return typeof amount === "string" && /^\d+(\.\d+)?$/.test(amount) && !/^0+(\.0+)?$/.test(amount);
}

/**
 * What's still missing before the form can be sent, in words (the server
 * checks again). `amount` is the request's own, as the server sent it: a new
 * account with an opening deposit needs the deposit's method.
 */
export function decisionProblems(type: PortalRequestType, form: DecisionForm, amount: string | null = null): string[] {
  const problems: string[] = [];
  if (needsMessage(form.decision) && form.message.trim() === "") {
    problems.push("Write a message to the member: it is shown on their request.");
  }
  const money = form.decision === "approve" ? moneyDetailsFor(type) : null;
  if (money && form.money.date === "") problems.push(money === "payout" ? "Enter the payout date." : "Enter the date the deposit was received.");
  if (money === "payout" && form.money.method === "") problems.push("Choose how the money was paid out.");
  if (money === "deposit" && form.money.method === "" && aboveZero(amount)) problems.push("Choose how the opening deposit was paid.");
  return problems;
}

/** The decision body. Payout and deposit go only with an approval of their own type. */
export function decisionBody(type: PortalRequestType, form: DecisionForm): PortalDecisionInput {
  const body: PortalDecisionInput = { decision: form.decision };
  const message = form.message.trim();
  if (message !== "") body.message = message;
  if (form.decision !== "approve") return body;
  const reference = form.money.reference.trim();
  const money = moneyDetailsFor(type);
  if (money === "payout") {
    body.payout = { date: form.money.date, method: form.money.method, ...(reference ? { reference } : {}) };
  } else if (money === "deposit") {
    body.deposit = {
      date: form.money.date,
      ...(form.money.method ? { method: form.money.method } : {}),
      ...(reference ? { reference } : {}),
    };
  }
  return body;
}

/** What the server's answer means, for the toast. Never shown before it answers. */
export function decisionOutcome(type: PortalRequestType, decision: PortalRequestDecision, status: number): string {
  if (decision !== "approve") {
    if (decision === "reject") return type === "savings_withdrawal" ? "Request rejected. The held money was released." : "Request rejected.";
    if (decision === "need_info") return "The member was asked for more information.";
    return "The request is under review.";
  }
  if (status === 202) {
    return "Waiting for a second approval. The withdrawal posts once another user approves it in Savings Approvals.";
  }
  if (type === "savings_withdrawal") return "Withdrawal approved and posted.";
  if (type === "savings_opening") return "Savings account opened.";
  return "Profile change approved and saved to the member's record.";
}

/** After a 409 (a stale status, access ended, the hold lapsed) the request is read again, so its status and buttons are current. */
export function reloadAfterFailure(err: unknown): boolean {
  return httpStatusOf(err) === 409;
}
