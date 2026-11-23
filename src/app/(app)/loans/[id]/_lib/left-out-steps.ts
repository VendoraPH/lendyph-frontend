// The steps a loan's chain left out by their minimum principal (Phase 6
// MB-BE6), placed in the approval card's chain. The server lists them as
// `left_out_steps` with its own sentence for each; this only decides where
// they sit among the steps the round kept and drops anything it can't show.
//
// Where: a step can carry a minimum only when it is an approval step after the
// first (never Submit, the first approval step or Release), so a left-out step
// always comes after the first approval step and before Release. The server
// sends no position, so they sit just before the Release step, in the
// server's order. That is exactly their place while only the first approval
// step is kept; with more kept approval steps the server would have to say
// which one each follows.

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
  const items: ApprovalChainItem[] = steps.map((step, position) => ({
    type: "step",
    key: `step-${step.index}`,
    step,
    position,
  }));
  const skipped: ApprovalChainItem[] = (Array.isArray(leftOut) ? leftOut : [])
    .filter(shown)
    .map((entry, i) => ({
      type: "left_out",
      key: `left-out-${i}-${entry.step_id}`,
      name: entry.name,
      description: entry.description,
    }));
  if (skipped.length === 0) return items;

  const release = steps.map((s) => s.kind).lastIndexOf("release");
  const at = release === -1 ? items.length : release;
  return [...items.slice(0, at), ...skipped, ...items.slice(at)];
}
