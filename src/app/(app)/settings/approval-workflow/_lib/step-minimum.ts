// A loan approval step's optional minimum principal (Phase 6 MB-BE6,
// multi-branch decision 10). A loan whose principal is below it has the step
// left out when it is submitted or re-submitted. The server checks and stores
// it (StepMinimum): pesos, two decimals, at least ₱0.01. The screen only
// decides where the field shows and puts the server's refusals beside their
// step; it never works an amount out.

import { validationErrors } from "@/lib/api-error";
import { formatCurrency } from "@/lib/format";
import type { ApprovalChainStep, ChainStepKind } from "@/services/approval-workflow.service";

export interface MinimumRule {
  allowed: boolean;
  /** Why the step can't carry a minimum, in words, or null when it can. */
  reason: string | null;
}

const SUBMIT_REASON = "The Submit step always applies, so it can't have a minimum principal.";
const RELEASE_REASON = "The Release step always applies, so it can't have a minimum principal.";
const FIRST_APPROVAL_REASON =
  "The first approval step always applies, so every loan keeps at least one approval. It can't have a minimum principal.";

/**
 * Whether the step at `index` may carry a minimum: an approval step after the
 * first. The Submit step, the first approval step and the Release step always
 * apply, so every loan keeps at least one approval (the server's
 * StepMinimum::refusalFor). A step being added is judged at the end of the
 * chain, where the dialog puts it.
 */
export function minimumRule(steps: readonly ApprovalChainStep[], index: number): MinimumRule {
  const step = steps[index];
  if (step?.kind === "submit") return { allowed: false, reason: SUBMIT_REASON };
  if (step?.kind === "release") return { allowed: false, reason: RELEASE_REASON };
  if (index === steps.findIndex((s) => s.kind === "approve")) {
    return { allowed: false, reason: FIRST_APPROVAL_REASON };
  }
  return { allowed: true, reason: null };
}

/**
 * The rule for the step dialog: the step at `index` (a new step at the end of
 * the chain, where it is added) as if it were of the kind picked.
 */
export function minimumRuleFor(
  steps: readonly ApprovalChainStep[],
  index: number,
  kind: ChainStepKind,
): MinimumRule {
  const draft = [...steps];
  draft[index] = { ...(steps[index] ?? { id: "", name: "", role: "" }), kind };
  return minimumRule(draft, index);
}

/**
 * The minimum to send for what was typed: null for an empty field (no
 * minimum), otherwise the text without the peso sign, commas and spaces. It
 * is not checked here: the server refuses a bad amount in its own words.
 */
export function minimumToSend(typed: string): string | null {
  const cleaned = typed.replace(/[₱,\s]/g, "");
  return cleaned === "" ? null : cleaned;
}

/** A peso amount the server would store as it is: whole pesos, or up to two decimals. */
const PESO_AMOUNT = /^\d+(\.\d{1,2})?$/;

/**
 * A step's minimum as the step list shows it, or null for none: the server's
 * stored amount in pesos, or an unsaved entry that isn't an amount as it was
 * typed (the save then shows the server's refusal under it), so a bad entry
 * never reads as ₱0.00 or as a rounded amount.
 */
export function minimumLabel(minimum: string | null | undefined): string | null {
  if (!minimum) return null;
  return PESO_AMOUNT.test(minimum)
    ? `Minimum principal ${formatCurrency(minimum)}`
    : `Minimum principal "${minimum}"`;
}

/** The step with this minimum, or with no `min_principal` key at all for none. */
export function withMinimum(step: ApprovalChainStep, minimum: string | null): ApprovalChainStep {
  const rest = { ...step };
  delete rest.min_principal;
  return minimum === null ? rest : { ...rest, min_principal: minimum };
}

/** Whether two minimums are the same, no minimum however it is spelled. */
export function sameMinimum(a: string | null | undefined, b: string | null | undefined): boolean {
  return (a || null) === (b || null);
}

const MINIMUM_ERROR_KEY = /^steps\.(\d+)\.min_principal$/;

/**
 * The server's 422 refusals of minimums (`steps.{i}.min_principal`), by the
 * id of the step they name, `i` being its place in the chain that was sent.
 * Anything else gives nothing.
 */
export function stepMinimumErrors(err: unknown, sent: readonly ApprovalChainStep[]): Record<string, string> {
  const errors = validationErrors(err);
  if (!errors) return {};
  const byStep: Record<string, string> = {};
  for (const [key, messages] of Object.entries(errors)) {
    const match = MINIMUM_ERROR_KEY.exec(key);
    const step = match ? sent[Number(match[1])] : undefined;
    if (step && messages[0]) byStep[step.id] = messages[0];
  }
  return byStep;
}
