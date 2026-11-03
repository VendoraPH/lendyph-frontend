/**
 * Interest batches: labels, tones, which actions to offer, and the period a
 * run covers. The server computes every figure and enforces every rule
 * (one batch per product and period, maker ≠ checker, post once); this only
 * decides which buttons to show and catches an impossible period early.
 */
import type { InterestBatch, InterestBatchStatus, InterestPreviewRequest } from "@/types/savings";
import type { BadgeTone } from "./account-status";

export const BATCH_STATUS_LABEL: Record<InterestBatchStatus, string> = {
  draft: "Draft",
  approved: "Approved",
  posted: "Posted",
  reversed: "Reversed",
  rejected: "Rejected",
};

export const BATCH_STATUS_TONE: Record<InterestBatchStatus, BadgeTone> = {
  draft: "info",
  approved: "warning",
  posted: "success",
  reversed: "muted",
  rejected: "danger",
};

export interface BatchActions {
  approve: boolean;
  reject: boolean;
  post: boolean;
  reverse: boolean;
  /** The viewer created the batch, so they may not approve or reject it. */
  ownBatch: boolean;
}

export interface BatchViewer {
  canApprove: boolean;
  canPost: boolean;
  userId: number | null;
}

/**
 * A draft waits for approval unless the server says it doesn't
 * (`requires_approval: false`); an unknown answer is treated as "it does", so
 * Post is never offered for a batch the server would refuse.
 */
export function batchActions(batch: InterestBatch, viewer: BatchViewer): BatchActions {
  const ownBatch = viewer.userId !== null && batch.created_by?.id === viewer.userId;
  const needsApproval = batch.requires_approval !== false;
  const draft = batch.status === "draft";
  const review = draft && needsApproval && viewer.canApprove;
  return {
    approve: review,
    reject: review,
    post: viewer.canPost && (batch.status === "approved" || (draft && !needsApproval)),
    reverse: viewer.canPost && batch.status === "posted",
    ownBatch,
  };
}

export interface InterestRunForm {
  periodFrom: string | null;
  periodTo: string | null;
  productId: string;
  branchId: string;
}

/** "all" in a Select means no filter. */
const ALL = "all";

/** The last full calendar month before `today` (YYYY-MM-DD): the usual run. */
export function previousMonth(today: string): { from: string; to: string } {
  const [y, m] = today.split("-").map(Number);
  const year = m === 1 ? y - 1 : y;
  const month = m === 1 ? 12 : m - 1;
  // Day 0 of the next month is the last day of this one; UTC keeps it a pure calendar sum.
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const mm = String(month).padStart(2, "0");
  return { from: `${year}-${mm}-01`, to: `${year}-${mm}-${String(lastDay).padStart(2, "0")}` };
}

export function emptyRunForm(today: string): InterestRunForm {
  const { from, to } = previousMonth(today);
  return { periodFrom: from, periodTo: to, productId: ALL, branchId: ALL };
}

export type RunCheck = { ok: true; request: InterestPreviewRequest } | { ok: false; message: string };

/**
 * The request for a preview or a batch. Interest is earned on days that have
 * ended, so the period may not end after today.
 */
export function interestRequest(form: InterestRunForm, today: string): RunCheck {
  const { periodFrom: from, periodTo: to } = form;
  if (!from || !to) return { ok: false, message: "Choose the period's first and last day." };
  if (from > to) return { ok: false, message: "The period must start on or before its last day." };
  if (to > today) return { ok: false, message: "Interest can only be computed for days that have ended." };
  return {
    ok: true,
    request: {
      period_from: from,
      period_to: to,
      savings_product_id: form.productId === ALL ? null : Number(form.productId),
      branch_id: form.branchId === ALL ? null : Number(form.branchId),
    },
  };
}
