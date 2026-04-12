// Approval Workflow Service
// ---------------------------------------------------------------------------
// Mock service layer for configuring the loan approval chain. Currently
// backed by localStorage so admins can customize the chain without code
// changes. The shape and method signatures mirror what a real REST API
// would expose, so swapping to a backend is a one-line change inside the
// methods below (replace localStorage with api.get/api.post calls).
// ---------------------------------------------------------------------------

export type ChainStepKind = "submit" | "approve" | "release";

export interface ApprovalChainStep {
  id: string;         // Stable identifier (slug)
  name: string;       // Display name ("Manager", "BOD1")
  role: string;       // Required role slug to act on this step
  kind: ChainStepKind;
}

const STORAGE_KEY = "approval-workflow-config";
const STORAGE_KEY_NORMAL = "approval-workflow-config-normal";

// Policy Exception chain — full BOD approval
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

// Normal loan flow — Manager approval, Chairwoman confirmation, Cashier release
const DEFAULT_NORMAL_CHAIN: ApprovalChainStep[] = [
  { id: "loan-processor", name: "Loan Processor", role: "loan_processor", kind: "submit" },
  { id: "manager", name: "Manager", role: "manager", kind: "approve" },
  { id: "chairwoman", name: "BOD Chairwoman", role: "bod1", kind: "approve" },
  { id: "cashier", name: "Cashier", role: "cashier", kind: "release" },
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

export const approvalWorkflowService = {
  /**
   * Fetch the current chain configuration. Returns the default chain if no
   * custom config has been saved.
   *
   * TODO(backend): replace with `api.get<ApprovalChainStep[]>("/settings/approval-workflow")`
   */
  async list(): Promise<ApprovalChainStep[]> {
    if (typeof window === "undefined") return DEFAULT_CHAIN;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return DEFAULT_CHAIN;
      const parsed = JSON.parse(raw) as ApprovalChainStep[];
      if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_CHAIN;
      // Validate the stored config; fall back to default if corrupted
      if (validateChain(parsed) !== null) return DEFAULT_CHAIN;
      return parsed;
    } catch {
      return DEFAULT_CHAIN;
    }
  },

  /**
   * Persist a new chain configuration. Validates the chain and throws if
   * it is invalid.
   *
   * TODO(backend): replace with `api.post("/settings/approval-workflow", { steps })`
   */
  async save(steps: ApprovalChainStep[]): Promise<ApprovalChainStep[]> {
    const error = validateChain(steps);
    if (error) {
      throw new Error(error.message);
    }
    if (typeof window === "undefined") return steps;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(steps));
    return steps;
  },

  /**
   * Reset the chain configuration back to the default.
   *
   * TODO(backend): replace with `api.delete("/settings/approval-workflow")`
   */
  async reset(): Promise<ApprovalChainStep[]> {
    if (typeof window === "undefined") return DEFAULT_CHAIN;
    localStorage.removeItem(STORAGE_KEY);
    return DEFAULT_CHAIN;
  },

  /**
   * Get the default chain without touching storage.
   */
  getDefault(): ApprovalChainStep[] {
    return DEFAULT_CHAIN;
  },

  /**
   * Validate a chain without saving. Useful for live form validation.
   */
  validate(steps: ApprovalChainStep[]): ChainValidationError | null {
    return validateChain(steps);
  },

  // ── Normal (non-policy-exception) workflow ──

  async listNormal(): Promise<ApprovalChainStep[]> {
    if (typeof window === "undefined") return DEFAULT_NORMAL_CHAIN;
    try {
      const raw = localStorage.getItem(STORAGE_KEY_NORMAL);
      if (!raw) return DEFAULT_NORMAL_CHAIN;
      const parsed = JSON.parse(raw) as ApprovalChainStep[];
      if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_NORMAL_CHAIN;
      if (validateChain(parsed) !== null) return DEFAULT_NORMAL_CHAIN;
      return parsed;
    } catch {
      return DEFAULT_NORMAL_CHAIN;
    }
  },

  async saveNormal(steps: ApprovalChainStep[]): Promise<ApprovalChainStep[]> {
    const error = validateChain(steps);
    if (error) throw new Error(error.message);
    if (typeof window === "undefined") return steps;
    localStorage.setItem(STORAGE_KEY_NORMAL, JSON.stringify(steps));
    return steps;
  },

  async resetNormal(): Promise<ApprovalChainStep[]> {
    if (typeof window === "undefined") return DEFAULT_NORMAL_CHAIN;
    localStorage.removeItem(STORAGE_KEY_NORMAL);
    return DEFAULT_NORMAL_CHAIN;
  },

  getDefaultNormal(): ApprovalChainStep[] {
    return DEFAULT_NORMAL_CHAIN;
  },

  /**
   * Get the correct chain for a loan based on policy_exception flag.
   */
  async listForLoan(policyException: boolean): Promise<ApprovalChainStep[]> {
    return policyException ? this.list() : this.listNormal();
  },
};
