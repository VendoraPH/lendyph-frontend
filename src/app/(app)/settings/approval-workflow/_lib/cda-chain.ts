// The CDA review chain editor (Settings → Approval Workflow, "CDA reports").
// Approve-only steps by role, 1 to 10, each name used once; the server checks
// all of it again (ApprovalWorkflowController::updateCda) and its 422 is shown
// as sent. These checks only keep Save from sending a chain the server would
// refuse, in the server's own words.
//
// Dependency-free, so it is unit-testable under `tsx --test`.

import type { CdaReviewChainStep } from "@/types/cda";

/** `CdaApprovalChain::MAX_STEPS`. */
export const CDA_MAX_STEPS = 10;

/** A step as the editor holds it; `key` is only the list's own handle. */
export interface CdaStepDraft {
  key: string;
  name: string;
  role: string;
  status: string;
}

let nextKey = 0;

/** A handle for a step added in the editor. */
export function newDraftKey(): string {
  nextKey += 1;
  return `new-step-${nextKey}`;
}

export function toDrafts(steps: readonly CdaReviewChainStep[]): CdaStepDraft[] {
  return steps.map((s, i) => ({
    key: s.id ?? `saved-step-${i}`,
    name: s.name,
    role: s.role,
    status: s.status ?? "",
  }));
}

/** What Save sends: the steps in order, approve-only, text trimmed, a blank status as null. */
export function cdaChainPayload(drafts: readonly CdaStepDraft[]): CdaReviewChainStep[] {
  return drafts.map((d) => ({
    name: d.name.trim(),
    role: d.role,
    kind: "approve",
    status: d.status.trim() || null,
  }));
}

/** The first reason the server would refuse the chain, in its words, or null. */
export function cdaChainProblem(drafts: readonly CdaStepDraft[]): string | null {
  if (drafts.length === 0) return "Add at least one review step, or reset the chain to keep a single review.";
  if (drafts.length > CDA_MAX_STEPS) return `A CDA review chain has at most ${CDA_MAX_STEPS} steps.`;
  const seen = new Set<string>();
  for (const d of drafts) {
    const name = d.name.trim();
    if (!name) return "Give each step a name.";
    if (!d.role) return "Choose the role for each step.";
    const key = name.replace(/\s+/g, " ").toLowerCase();
    if (seen.has(key)) return `Two steps are named "${name}". Give each step its own name.`;
    seen.add(key);
  }
  return null;
}

/** The list with one step moved; the same list when it is already at that end. */
export function moveDraft(drafts: CdaStepDraft[], index: number, direction: "up" | "down"): CdaStepDraft[] {
  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= drafts.length) return drafts;
  const next = [...drafts];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

/** Whether two chains would save the same. */
export function sameChain(a: readonly CdaStepDraft[], b: readonly CdaStepDraft[]): boolean {
  return JSON.stringify(cdaChainPayload(a)) === JSON.stringify(cdaChainPayload(b));
}
