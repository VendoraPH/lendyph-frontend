// Helpers for the multi-step approval chain on the loan detail page.
//
// The chain is loaded from approvalWorkflowService so admins can reconfigure
// it via /settings/approval-workflow. Each loan snapshots the chain at seed
// time, so changes to the config only affect NEW loans (in-flight loans keep
// whatever chain they started with).
//
// On any "Approved? = No" the loan is sent back to Loan Processor for
// revision (the chain does NOT support terminal rejection — "Void Loan"
// is the escape hatch for drafts).

import type { ApprovalChainStep } from "@/services";
import type {
  ApprovalState,
  ApprovalStep,
  ChainStepKind,
  RevisionRound,
} from "./approval-types";

export function buildFreshSteps(
  chain: ApprovalChainStep[],
  pendingIndex: number = 0,
): ApprovalStep[] {
  return chain.map((step, i) => ({
    index: i,
    name: step.name,
    role: step.role,
    kind: step.kind,
    status: i === pendingIndex ? "pending" : "waiting",
  }));
}

export function canUserActOnStep(
  step: ApprovalStep,
  userRoles: string[] | undefined,
): boolean {
  if (!userRoles || userRoles.length === 0) return false;
  // Admins can act on any step (useful for testing and for super-users)
  if (userRoles.includes("admin")) return true;
  return userRoles.includes(step.role);
}

export function approvalStorageKey(loanId: number | string): string {
  return `loan-approval-${loanId}`;
}

// Back-compat migration: older stored approval states were saved before
// the `kind` field existed on ApprovalStep. Without a kind, the action
// panel's conditional buttons (`kind === "approve"`) silently render
// nothing. Infer the kind from the step name so old loans still work.
export function migrateStep(step: ApprovalStep): ApprovalStep {
  if (step.kind) return step;
  const name = (step.name ?? "").toLowerCase();
  const inferred: ChainStepKind =
    name.includes("loan processor") || name.includes("processor")
      ? "submit"
      : name.includes("cashier") || name.includes("release")
        ? "release"
        : "approve";
  return { ...step, kind: inferred };
}

export function migrateSteps(steps: ApprovalStep[]): ApprovalStep[] {
  return steps.map(migrateStep);
}

export function loadApprovalState(
  loanId: number | string,
): ApprovalState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(approvalStorageKey(loanId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ApprovalState | ApprovalStep[];
    // Back-compat: earlier version stored a bare array
    if (Array.isArray(parsed)) {
      return { current_steps: migrateSteps(parsed), rounds: [] };
    }
    if (!parsed.current_steps || !Array.isArray(parsed.current_steps))
      return null;
    return {
      current_steps: migrateSteps(parsed.current_steps),
      rounds: (parsed.rounds ?? []).map((r: RevisionRound) => ({
        ...r,
        steps: migrateSteps(r.steps),
      })),
    };
  } catch {
    return null;
  }
}

export function saveApprovalState(
  loanId: number | string,
  state: ApprovalState,
) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(approvalStorageKey(loanId), JSON.stringify(state));
  } catch {
    /* ignore quota errors */
  }
}

// Derive where the loan should be in the chain based on its server status.
// Used to seed a fresh state when localStorage has nothing for this loan.
// The chain is whatever the admin has configured via the settings page.
export function deriveStepsFromLoanStatus(
  chain: ApprovalChainStep[],
  status: string,
): ApprovalStep[] {
  const steps = buildFreshSteps(chain);
  if (steps.length === 0) return steps;

  const firstApproveIdx = steps.findIndex((s) => s.kind === "approve");
  const lastApproveIdx = (() => {
    for (let i = steps.length - 1; i >= 0; i--) {
      if (steps[i].kind === "approve") return i;
    }
    return -1;
  })();
  const releaseIdx = steps.findIndex((s) => s.kind === "release");

  if (status === "draft") {
    // Loan Processor (submit step, index 0) is pending
    return steps;
  }
  if (status === "for_review") {
    // Submit done; first approve step is pending
    steps[0] = { ...steps[0], status: "approved" };
    if (firstApproveIdx >= 0) {
      steps[firstApproveIdx] = { ...steps[firstApproveIdx], status: "pending" };
    }
    return steps;
  }
  if (status === "approved") {
    // All approve steps done; release step is pending
    for (let i = 0; i <= lastApproveIdx; i++) {
      steps[i] = { ...steps[i], status: "approved" };
    }
    if (releaseIdx >= 0) {
      steps[releaseIdx] = { ...steps[releaseIdx], status: "pending" };
    }
    return steps;
  }
  if (
    status === "released" ||
    status === "ongoing" ||
    status === "completed" ||
    status === "closed" ||
    status === "defaulted" ||
    status === "restructured"
  ) {
    // Full chain done
    return steps.map((s) => ({ ...s, status: "approved" }));
  }
  // draft-like fallback
  return steps;
}
