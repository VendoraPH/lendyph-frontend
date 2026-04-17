// Approval Workflow Service
// ---------------------------------------------------------------------------
// Backed by the real API at /settings/approval-workflow. The backend swagger
// does not document the request/response body shape, so we:
//   * bypass api-client's auto-unwrap and talk to axios directly
//   * accept multiple response shapes (array, {steps}, {data:{steps}}, etc.)
// The normal and policy-exception chains are stored server-side; this module
// is a thin wrapper plus a synchronous default fallback used by loan
// snapshotting when the server is unreachable.
// ---------------------------------------------------------------------------

import axiosClient from "@/lib/axios-client";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import type { LoanStatus } from "@/types/loan";

export type ChainStepKind = "submit" | "approve" | "release";

export interface ApprovalChainStep {
  id: string;
  name: string;
  role: string;
  kind: ChainStepKind;
  status?: LoanStatus;
}

type ChainType = "normal" | "policy_exception";

// Policy Exception chain — full BOD approval. Used as a client-side
// fallback and for pre-submit validation; the server owns the source of truth.
const DEFAULT_CHAIN: ApprovalChainStep[] = [
  { id: "loan-processor", name: "Loan Processor", role: "loan_processor", kind: "submit" },
  { id: "manager", name: "Manager", role: "manager", kind: "approve" },
  { id: "bod1", name: "BOD1", role: "bod1", kind: "approve" },
  { id: "bod2", name: "BOD2", role: "bod2", kind: "approve" },
  { id: "bod3", name: "BOD3", role: "bod3", kind: "approve" },
  { id: "bod4", name: "BOD4", role: "bod4", kind: "approve" },
  { id: "bod5", name: "BOD5", role: "bod5", kind: "approve" },
  { id: "bod6", name: "BOD6", role: "bod6", kind: "approve" },
  { id: "bod7", name: "BOD7", role: "bod7", kind: "approve" },
  { id: "cashier", name: "Cashier", role: "cashier", kind: "release" },
];

// Normal loan flow — Manager approval, Chairwoman confirmation, General Bookkeeper release
const DEFAULT_NORMAL_CHAIN: ApprovalChainStep[] = [
  { id: "loan-processor", name: "Loan Processor", role: "loan_processor", kind: "submit" },
  { id: "manager", name: "Manager", role: "manager", kind: "approve" },
  { id: "chairwoman", name: "BOD Chairwoman", role: "bod1", kind: "approve" },
  { id: "general-bookkeeper", name: "General Bookkeeper", role: "general_bookkeeper", kind: "release" },
];

export interface ChainValidationError {
  code:
    | "empty"
    | "no_submit"
    | "no_release"
    | "submit_not_first"
    | "release_not_last"
    | "duplicate_ids"
    | "missing_fields";
  message: string;
}

function validateChain(steps: ApprovalChainStep[]): ChainValidationError | null {
  if (steps.length === 0) {
    return { code: "empty", message: "Chain must have at least one step." };
  }
  const ids = new Set<string>();
  for (const step of steps) {
    if (!step.id || !step.name.trim() || !step.role.trim()) {
      return {
        code: "missing_fields",
        message: "Every step must have an id, name, and role.",
      };
    }
    if (ids.has(step.id)) {
      return {
        code: "duplicate_ids",
        message: `Duplicate step id: "${step.id}".`,
      };
    }
    ids.add(step.id);
  }
  const firstSubmit = steps.findIndex((s) => s.kind === "submit");
  if (firstSubmit === -1) {
    return {
      code: "no_submit",
      message: "Chain must start with a Submit step (Loan Processor).",
    };
  }
  if (firstSubmit !== 0) {
    return {
      code: "submit_not_first",
      message: "The Submit step must be the first step in the chain.",
    };
  }
  const lastRelease = steps.map((s) => s.kind).lastIndexOf("release");
  if (lastRelease === -1) {
    return {
      code: "no_release",
      message: "Chain must end with a Release step (Cashier).",
    };
  }
  if (lastRelease !== steps.length - 1) {
    return {
      code: "release_not_last",
      message: "The Release step must be the last step in the chain.",
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Response shape coercion
// ---------------------------------------------------------------------------
// The backend swagger doesn't document the chain response shape, so we
// probe several possibilities and pull out the array no matter how it's
// wrapped. Known shapes in the wild:
//   [ ...steps ]
//   { steps: [...] }
//   { type, steps: [...] }
//   { success, data: [...] }
//   { success, data: { steps: [...] } }
//   { success, data: { type, steps: [...] } }
//   { data: [...] }
//   { data: { steps: [...] } }

const LOAN_STATUS_VALUES: readonly LoanStatus[] = [
  "draft",
  "for_review",
  "approved",
  "rejected",
  "released",
  "ongoing",
  "completed",
  "defaulted",
  "restructured",
  "closed",
];

function isApprovalChainStep(v: unknown): v is ApprovalChainStep {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  const statusValid =
    o.status === undefined ||
    o.status === null ||
    (typeof o.status === "string" &&
      (LOAN_STATUS_VALUES as readonly string[]).includes(o.status));
  return (
    typeof o.id === "string" &&
    typeof o.name === "string" &&
    typeof o.role === "string" &&
    (o.kind === "submit" || o.kind === "approve" || o.kind === "release") &&
    statusValid
  );
}

function extractSteps(payload: unknown): ApprovalChainStep[] {
  if (Array.isArray(payload) && payload.every(isApprovalChainStep)) {
    return payload;
  }
  if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>;
    if (Array.isArray(obj.steps) && obj.steps.every(isApprovalChainStep)) {
      return obj.steps as ApprovalChainStep[];
    }
    if (obj.data !== undefined) {
      return extractSteps(obj.data);
    }
  }
  throw new Error("Unexpected approval workflow response shape");
}

// ---------------------------------------------------------------------------
// HTTP helpers (bypass api-client's auto-unwrap so we see the raw envelope)
// ---------------------------------------------------------------------------

async function fetchChain(type: ChainType): Promise<ApprovalChainStep[]> {
  const { data } = await axiosClient.get(API_ENDPOINTS.SETTINGS.APPROVAL_WORKFLOW, {
    params: { type },
  });
  return extractSteps(data);
}

async function putChain(
  type: ChainType,
  steps: ApprovalChainStep[]
): Promise<ApprovalChainStep[]> {
  const { data } = await axiosClient.put(API_ENDPOINTS.SETTINGS.APPROVAL_WORKFLOW, {
    type,
    steps,
  });
  // Some backends return 204/empty or a plain success envelope on PUT; in
  // that case fall back to a follow-up GET so the caller always receives
  // the freshly persisted chain.
  try {
    return extractSteps(data);
  } catch {
    return fetchChain(type);
  }
}

async function deleteChain(type: ChainType): Promise<ApprovalChainStep[]> {
  const { data } = await axiosClient.delete(API_ENDPOINTS.SETTINGS.APPROVAL_WORKFLOW, {
    params: { type },
  });
  try {
    return extractSteps(data);
  } catch {
    return fetchChain(type);
  }
}

export const approvalWorkflowService = {
  // ── Policy Exception chain ──

  /** Fetch the current policy-exception chain from the backend. */
  async list(): Promise<ApprovalChainStep[]> {
    return fetchChain("policy_exception");
  },

  /** Persist a new policy-exception chain. Client-validates before sending. */
  async save(steps: ApprovalChainStep[]): Promise<ApprovalChainStep[]> {
    const error = validateChain(steps);
    if (error) {
      throw new Error(error.message);
    }
    return putChain("policy_exception", steps);
  },

  /** Reset the policy-exception chain back to the server-side default. */
  async reset(): Promise<ApprovalChainStep[]> {
    return deleteChain("policy_exception");
  },

  /** Synchronous default — used by loan snapshotting when the server is unreachable. */
  getDefault(): ApprovalChainStep[] {
    return DEFAULT_CHAIN;
  },

  /** Validate a chain without saving. Useful for live form validation. */
  validate(steps: ApprovalChainStep[]): ChainValidationError | null {
    return validateChain(steps);
  },

  // ── Normal (non-policy-exception) chain ──

  async listNormal(): Promise<ApprovalChainStep[]> {
    return fetchChain("normal");
  },

  async saveNormal(steps: ApprovalChainStep[]): Promise<ApprovalChainStep[]> {
    const error = validateChain(steps);
    if (error) throw new Error(error.message);
    return putChain("normal", steps);
  },

  async resetNormal(): Promise<ApprovalChainStep[]> {
    return deleteChain("normal");
  },

  getDefaultNormal(): ApprovalChainStep[] {
    return DEFAULT_NORMAL_CHAIN;
  },

  /** Get the correct chain for a loan based on policy_exception flag. */
  async listForLoan(policyException: boolean): Promise<ApprovalChainStep[]> {
    return policyException ? this.list() : this.listNormal();
  },
};
