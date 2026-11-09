/**
 * The Allowance for Credit Losses screen's rules, kept pure so they run under
 * `tsx --test`.
 *
 * Every figure here is the server's: each bucket's principal and required
 * amount, each branch's required, current balance and adjustment, the totals,
 * and whether it can post. The browser turns centavos into text and reads the
 * sign of the server's adjustment to say "Provide" or "Release". It never
 * adds, nets or multiplies money and never works out a rate.
 */

import { getErrorMessage, httpStatusOf } from "@/lib/api-error";
import { formatCentavos } from "@/lib/accounting/money";
import { formatDate, formatDateTime } from "@/lib/format";
import { formatCount } from "@/lib/report-format";
import type {
  AllowanceBranch,
  AllowancePostingPage,
  AllowancePreview,
  AllowanceRun,
  AccountingJournalRef,
  Permission,
} from "@/types";
import { allowanceBucketLabel } from "../../_lib/display-labels";

export const DASH = "—";

/**
 * Posting the allowance needs its own permission (round C, Lead's call 3).
 * FE-C1 adds `allowance` to `Action` in `src/types/rbac.ts`; this slice
 * doesn't own that file, so the key is widened to `Permission` here. With
 * FE-C1 merged the cast is redundant and can go.
 */
export const ALLOWANCE_PERMISSION = "accounting:allowance" as string as Permission;
export const HISTORY_PER_PAGE = 25;
export const POST_PERMISSION_REASON = "You need permission to post the allowance";
export const CONFLICT_MESSAGE =
  "The figures changed since the preview, so they have been loaded again. Review them before posting.";
const POST_FALLBACK = "Could not post the allowance.";

const isFigure = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

/** The server's centavos as ₱ with two decimals; a dash when it sent none. */
export function money(value: number | null | undefined): string {
  return isFigure(value) ? formatCentavos(value) : DASH;
}

const count = (value: number | null | undefined): string =>
  isFigure(value) ? formatCount(value) : DASH;

/** A rate exactly as the server wrote it: "5" reads "5%", "2.375" reads "2.375%". */
export function rateText(ratePercent: string | null | undefined): string {
  return ratePercent === null || ratePercent === undefined || ratePercent === ""
    ? DASH
    : `${ratePercent}%`;
}

export type AdjustmentDirection = "provide" | "release" | "none";

export function adjustmentDirection(adjustment: number | null | undefined): AdjustmentDirection | null {
  if (!isFigure(adjustment)) return null;
  if (adjustment > 0) return "provide";
  return adjustment < 0 ? "release" : "none";
}

/** The server's adjustment in words: positive provides, negative releases. */
export function adjustmentText(adjustment: number | null | undefined): string {
  const direction = adjustmentDirection(adjustment);
  if (direction === null || !isFigure(adjustment)) return DASH;
  if (direction === "none") return "No change";
  const amount = formatCentavos(Math.abs(adjustment));
  return direction === "provide" ? `Provide ${amount}` : `Release ${amount}`;
}

export interface RateChip {
  bucket: string;
  text: string;
}

export function rateStrip(preview: AllowancePreview): RateChip[] {
  return preview.rates.map((rate) => ({
    bucket: rate.bucket,
    text: `${allowanceBucketLabel(rate.bucket)} ${rateText(rate.rate_percent)}`,
  }));
}

export interface BucketRowView {
  bucket: string;
  label: string;
  loans: string;
  principal: string;
  rate: string;
  required: string;
}

export interface BranchView {
  id: number;
  name: string;
  rows: BucketRowView[];
  principal: string;
  required: string;
  currentBalance: string;
  adjustment: string;
  direction: AdjustmentDirection | null;
}

function branchView(branch: AllowanceBranch): BranchView {
  return {
    id: branch.branch.id,
    name: branch.branch.name,
    rows: (branch.buckets ?? []).map((row) => ({
      bucket: row.bucket,
      label: allowanceBucketLabel(row.bucket),
      loans: count(row.loan_count),
      principal: money(row.principal),
      rate: rateText(row.rate_percent),
      required: money(row.required),
    })),
    principal: money(branch.principal),
    required: money(branch.required),
    currentBalance: money(branch.current_balance),
    adjustment: adjustmentText(branch.adjustment),
    direction: adjustmentDirection(branch.adjustment),
  };
}

export function branchViews(preview: AllowancePreview): BranchView[] {
  return preview.branches.map(branchView);
}

export interface TotalsView {
  loans: string;
  principal: string;
  required: string;
  currentBalance: string;
  adjustment: string;
}

/** The preview's `totals`, as sent. */
export function totalsView(preview: AllowancePreview): TotalsView {
  const totals = preview.totals;
  return {
    loans: count(totals?.loan_count),
    principal: money(totals?.principal),
    required: money(totals?.required),
    currentBalance: money(totals?.current_balance),
    adjustment: adjustmentText(totals?.adjustment),
  };
}

/** The 1200 balance on journals with no branch: named; the server won't post while it isn't 0. */
export function unassignedNotice(balance: number | null | undefined): string | null {
  if (!isFigure(balance) || balance <= 0) return null;
  return `${formatCentavos(balance)} of the allowance is on journals with no branch. The allowance can't be posted until it is moved to the branches with one entry per branch.`;
}

export function lastPostingText(last: AllowancePreview["last_posting"]): string {
  if (!last) return "Not posted yet.";
  const by = last.posted_by?.name ? ` by ${last.posted_by.name}` : "";
  return `Last posted as of ${formatDate(last.as_of)}${by}`;
}

/** The post needs `accounting:allowance`, `accounting:view` and `branches:view_all`. */
export function canPostAllowance(can: (permission: Permission) => boolean): boolean {
  return can(ALLOWANCE_PERMISSION) && can("accounting:view") && can("branches:view_all");
}

export interface PostState {
  enabled: boolean;
  /** Why the user can't post at all; the disabled button's reason. */
  reason: string | null;
  /** The server's `blocking_reasons`, exactly as sent, whenever it can't post. */
  reasons: string[];
}

/** Enabled only with the permissions and the server's `can_post`. */
export function postState(preview: AllowancePreview, canPost: boolean): PostState {
  const reasons = preview.can_post ? [] : (preview.blocking_reasons ?? []);
  if (!canPost) return { enabled: false, reason: POST_PERMISSION_REASON, reasons };
  return { enabled: preview.can_post, reason: null, reasons };
}

export interface ConfirmLines {
  branches: Array<{ id: number; name: string; text: string }>;
  total: string;
}

/** What the confirm dialog lists: each branch's adjustment and the server's total. */
export function confirmLines(preview: AllowancePreview): ConfirmLines {
  return {
    branches: preview.branches.map((branch) => ({
      id: branch.branch.id,
      name: branch.branch.name,
      text: adjustmentText(branch.adjustment),
    })),
    total: adjustmentText(preview.totals?.adjustment),
  };
}

export type PostAllowance = (asOf: string, expectedAdjustment: number) => Promise<AllowanceRun>;

/** Posts for the preview's own date, sending its `totals.adjustment` as `expected_adjustment`. */
export function postFromPreview(preview: AllowancePreview, post: PostAllowance): Promise<AllowanceRun> {
  return post(preview.as_of, preview.totals.adjustment);
}

/** The fields a refused post names: the As of date, the allowance itself, or the books' setup. */
export type PostField = "as_of" | "allowance" | "accounting";
const POST_FIELDS: readonly PostField[] = ["as_of", "allowance", "accounting"];

export type PostFailure =
  | { kind: "conflict" }
  | { kind: "error"; field: PostField | null; message: string };

/**
 * 409: the figures moved (or a collision), so the preview reloads. A 422 names
 * its field, so the screen shows the server's words beside it; anything else
 * is the server's words alone.
 */
export function postFailure(err: unknown): PostFailure {
  if (httpStatusOf(err) === 409) return { kind: "conflict" };
  const errors =
    (err as { response?: { data?: { errors?: Record<string, unknown> } } } | null)?.response?.data
      ?.errors ?? {};
  const field = POST_FIELDS.find((key) => key in errors) ?? null;
  const sent = field ? errors[field] : null;
  const first = Array.isArray(sent) && typeof sent[0] === "string" ? sent[0] : null;
  return { kind: "error", field, message: first ?? getErrorMessage(err, POST_FALLBACK) };
}

export function historyQuery(page: number, perPage: number) {
  return { page, per_page: perPage };
}

export interface HistoryRowView {
  id: number;
  asOf: string;
  branch: string;
  required: string;
  previousBalance: string;
  adjustment: string;
  journal: { label: string; href: string } | null;
  postedBy: string;
  postedAt: string;
}

const journalLink = (journal: AccountingJournalRef | null) =>
  journal ? { label: journal.journal_no, href: `/accounting/journals/${journal.id}` } : null;

export function historyRows(page: AllowancePostingPage): HistoryRowView[] {
  return page.data.map((row) => ({
    id: row.id,
    asOf: row.as_of ? formatDate(row.as_of) : DASH,
    branch: row.branch?.name ?? DASH,
    required: money(row.required),
    previousBalance: money(row.previous_balance),
    adjustment: adjustmentText(row.adjustment),
    journal: journalLink(row.journal),
    postedBy: row.created_by?.name ?? DASH,
    postedAt: row.created_at ? formatDateTime(row.created_at) : DASH,
  }));
}

/** `meta.totals.adjustment`, over every matching posting. */
export function historyTotal(page: AllowancePostingPage): string {
  return adjustmentText(page.meta?.totals?.adjustment);
}

/** Why the screen can't show anything without access to every branch; null when it can. */
export function accessNotice(canViewAllBranches: boolean): string | null {
  if (canViewAllBranches) return null;
  return "The allowance is worked out and posted for every branch at once, so this screen needs access to every branch. Ask an administrator for it.";
}
