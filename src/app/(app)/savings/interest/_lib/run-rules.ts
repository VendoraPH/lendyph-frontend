import type { InterestRun, InterestRunLine, InterestRunRequest, InterestRunStatus, SavingsProduct } from "@/types";
import { INTEREST_RUN_STATUS_LABELS, labelOf, SKIP_REASON_LABELS, UNKNOWN_LABEL } from "../../_lib/savings-rules";

/**
 * Interest-run rules for the screens: which actions a run offers, the
 * request a "New run" form sends, and the words for statuses and skip
 * reasons. Every figure (balances, interest, tax, net) is the server's; none
 * is worked out here.
 */

export const MAKER_APPROVE_REASON = "You created this run; another user must approve it";

/** Status tabs for the runs list, in display order. */
export const RUN_STATUS_TABS: ReadonlyArray<{ value: "all" | InterestRunStatus; label: string }> = [
  { value: "all", label: "All" },
  ...(["draft", "approved", "posted", "rejected", "reversed"] as const).map((value) => ({
    value,
    label: INTEREST_RUN_STATUS_LABELS[value],
  })),
];

export interface RunActions {
  /** Shown on a draft. `approveBlocked` says why the viewer can't approve it. */
  approve: boolean;
  approveBlocked: string | null;
  reject: boolean;
  /** Shown on an approved run. */
  post: boolean;
  /** Shown on a posted run. Only the latest posted run can be reversed; the server checks it. */
  reverse: boolean;
}

/**
 * The actions a run offers by its status. Permission is left to
 * `PermissionButton`, which shows a missing one with its reason. The maker
 * may never approve their own run (the server answers 403).
 */
export function runActions(
  run: Pick<InterestRun, "status" | "created_by">,
  userId: number | null,
): RunActions {
  const draft = run.status === "draft";
  const ownRun = userId !== null && run.created_by?.id === userId;
  return {
    approve: draft,
    approveBlocked: draft && ownRun ? MAKER_APPROVE_REASON : null,
    reject: draft,
    post: run.status === "approved",
    reverse: run.status === "posted",
  };
}

export interface RunForm {
  /** A product id as text, or "" when none is picked. */
  productId: string;
  /** YYYY-MM-DD. */
  periodStart: string;
  /** `ALL_BRANCHES` or a branch id as text. */
  branch: string;
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** True for a real calendar date written YYYY-MM-DD. */
export function isIsoDate(value: string): boolean {
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const [, y, m, d] = match.map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export type RunRequestCheck = { ok: true; request: InterestRunRequest } | { ok: false; message: string };

/**
 * The body for preview and create: `{product_id, period_start, branch_ids?}`.
 * No branch means every branch the caller can see, one draft each.
 */
export function buildRunRequest(form: RunForm, branchId: number | undefined): RunRequestCheck {
  if (!/^\d+$/.test(form.productId) || Number(form.productId) < 1) {
    return { ok: false, message: "Pick a savings product." };
  }
  if (!isIsoDate(form.periodStart)) {
    return { ok: false, message: "Enter the first day of the period." };
  }
  return {
    ok: true,
    request: {
      product_id: Number(form.productId),
      period_start: form.periodStart,
      ...(branchId === undefined ? {} : { branch_ids: [branchId] }),
    },
  };
}

/** Products interest runs apply to: regular savings (time deposits earn on their own terms). */
export function runProductOptions(products: readonly SavingsProduct[]): Array<{ value: string; label: string }> {
  return products
    .filter((p) => p.kind === "regular")
    .map((p) => ({ value: String(p.id), label: `${p.name} (${p.code})` }));
}

/** Why a line earns nothing, in words, or null when it earns. */
export function skipReasonText(line: Pick<InterestRunLine, "skip_reason">): string | null {
  if (!line.skip_reason) return null;
  const text = labelOf(SKIP_REASON_LABELS, line.skip_reason);
  return text === UNKNOWN_LABEL ? "Not credited" : text;
}

/** The toast after creating runs: one draft per branch. */
export function createdMessage(runs: readonly InterestRun[]): string {
  if (runs.length === 1) return "Draft run created";
  return `${runs.length} draft runs created, one per branch`;
}
