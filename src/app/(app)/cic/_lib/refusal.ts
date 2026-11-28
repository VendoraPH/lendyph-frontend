// What a CIC refusal carries beside its message: the server's refusal code and,
// for a file the server won't generate or encrypt, its validation counts.
// The message itself is shown through `notifyError`, in the server's words.
import type { CicValidationSummary } from "@/types/cic";

export interface CicRefusal {
  code: string | null;
  validation: CicValidationSummary | null;
}

function isValidation(v: unknown): v is CicValidationSummary {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return typeof o.errors === "number" && typeof o.warnings === "number" && Array.isArray(o.top_issues);
}

export function cicRefusal(err: unknown): CicRefusal {
  const body = (err as { response?: { data?: unknown } } | null)?.response?.data;
  if (!body || typeof body !== "object") return { code: null, validation: null };
  const { code, data } = body as { code?: unknown; data?: { validation?: unknown } | null };
  return {
    code: typeof code === "string" ? code : null,
    validation: isValidation(data?.validation) ? data.validation : null,
  };
}
