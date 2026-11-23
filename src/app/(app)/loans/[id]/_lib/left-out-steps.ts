// The steps a loan's chain left out by their minimum principal (Phase 6
// MB-BE6), placed in the approval card's chain. The server lists them as
// `left_out_steps`, each with its own sentence and the step it follows; this
// only puts them there among the steps the round kept, and drops anything it
// can't show.
//
// Where each one goes:
//   - `after_step_id` names a kept step: right after it;
//   - `after_step_id` is null: before the first kept approval step;
//   - absent (an API from before it), or naming no kept step: just before
//     Release. A step can carry a minimum only when it is an approval step
//     after the first, so that is always inside its stretch of the chain,
//     and exact while only the first approval step is kept.
// Several for the same place keep the server's order.

import type { LoanApprovalLeftOutStep, LoanApprovalStep } from "@/types/loan-approval";

export type ApprovalChainItem =
  | {
      type: "step";
      key: string;
      step: LoanApprovalStep;
      /** The step's place among the kept steps (0-based): its number and "Step N of M" count only them. */
      position: number;
    }
  | {
      type: "left_out";
      key: string;
      name: string;
      /** The server's sentence, as it is. */
      description: string;
    };

type LeftOutItem = Extract<ApprovalChainItem, { type: "left_out" }>;

/** An entry the card can show: a name and the server's words, both not blank. */
function shown(entry: unknown): entry is LoanApprovalLeftOutStep {
  if (!entry || typeof entry !== "object") return false;
  const { name, description } = entry as Partial<LoanApprovalLeftOutStep>;
  return typeof name === "string" && name.trim() !== "" && typeof description === "string" && description.trim() !== "";
}

/**
 * The approval card's chain: the round's steps, with each left-out step in
 * its place, muted. Absent or empty `left_out_steps` gives the steps alone.
 */
export function approvalChainItems(
  steps: readonly LoanApprovalStep[],
  leftOut: readonly LoanApprovalLeftOutStep[] | null | undefined,
): ApprovalChainItem[] {
  const keptIds = new Set(steps.map((s) => String(s.step_id)));
  const afterStep = new Map<string, LeftOutItem[]>();
  const beforeFirstApproval: LeftOutItem[] = [];
  const beforeRelease: LeftOutItem[] = [];

  (Array.isArray(leftOut) ? leftOut : []).filter(shown).forEach((entry, i) => {
    const item: LeftOutItem = {
      type: "left_out",
      key: `left-out-${i}-${entry.step_id}`,
      name: entry.name,
      description: entry.description,
    };
    const after = entry.after_step_id;
    if (after === null) {
      beforeFirstApproval.push(item);
    } else if (after !== undefined && keptIds.has(String(after))) {
      const id = String(after);
      afterStep.set(id, [...(afterStep.get(id) ?? []), item]);
    } else {
      beforeRelease.push(item);
    }
  });

  const firstApproval = steps.findIndex((s) => s.kind === "approve");
  const release = steps.map((s) => s.kind).lastIndexOf("release");
  // No kept approval step to stand before: those go with the Release group.
  const releaseGroup = firstApproval === -1 ? [...beforeFirstApproval, ...beforeRelease] : beforeRelease;

  const items: ApprovalChainItem[] = [];
  steps.forEach((step, position) => {
    if (position === firstApproval) items.push(...beforeFirstApproval);
    if (position === release) items.push(...releaseGroup);
    items.push({ type: "step", key: `step-${step.index}`, step, position });
    const id = String(step.step_id);
    items.push(...(afterStep.get(id) ?? []));
    // Once, even if two kept steps ever shared an id.
    afterStep.delete(id);
  });
  if (release === -1) items.push(...releaseGroup);
  return items;
}
