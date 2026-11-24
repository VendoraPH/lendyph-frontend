import { mergeDraft, WIZARD_STEPS, type WizardErrors, type WizardStepId } from "@/lib/loan-origination";
import type { ApplicantLoanRequest, ApplicationDraft } from "@/types/loan-origination";
import type { EstimateRequest, PublicApplicationState, PublicDocument, PublicProduct } from "@/types/public-application";

/**
 * What blocks a step is the server's to say: LO-B2 sends `missing_fields` with
 * every saved draft, and a submit's 422 uses the same keys
 * (`draft.<section>.<field>`, `documents`, `<notice>_version`). The wizard only
 * sorts those messages by step; it never checks the draft itself.
 */

const PRODUCT_KEY = "draft.loan.loan_product_id";

/** The keys each data step answers for. The loan step holds the product too, so it never passes without one. */
const STEP_PREFIXES: Partial<Record<WizardStepId, string>> = {
  personal: "draft.personal.",
  employment: "draft.employment.",
  expenses: "draft.expenses.",
  loan: "draft.loan.",
};

/** The field a server key names inside its section (`draft.expenses.existing_loans.0.institution` → `existing_loans.0.institution`). */
const fieldOf = (key: string) => key.replace(/^draft\.[a-z_]+\./, "");

/** The server's messages for one step, keyed by field as the step's inputs are. */
export function stepErrors(step: WizardStepId, fields: Record<string, string>): WizardErrors {
  const errors: WizardErrors = {};
  const prefix = STEP_PREFIXES[step];
  for (const [key, message] of Object.entries(fields)) {
    const ours = step === "product" ? key === PRODUCT_KEY : prefix !== undefined && key.startsWith(prefix);
    if (ours) errors[fieldOf(key)] = message;
  }
  return errors;
}

/** The step a server key belongs to; anything else is the review's to show. */
function stepOfKey(key: string): WizardStepId {
  if (key === PRODUCT_KEY) return "product";
  for (const [step, prefix] of Object.entries(STEP_PREFIXES)) {
    if (key.startsWith(prefix)) return step as WizardStepId;
  }
  return key === "documents" ? "documents" : "review";
}

export interface StepProblems {
  step: WizardStepId;
  title: string;
  messages: string[];
}

/** Every refusal, by step in the wizard's order, so the review can send the applicant to each. */
export function problemsByStep(fields: Record<string, string>): StepProblems[] {
  const byStep = new Map<WizardStepId, string[]>();
  for (const [key, message] of Object.entries(fields)) {
    const step = stepOfKey(key);
    const messages = byStep.get(step) ?? [];
    if (!messages.includes(message)) messages.push(message);
    byStep.set(step, messages);
  }
  return WIZARD_STEPS.flatMap(({ id, title }) => {
    const messages = byStep.get(id);
    return messages ? [{ step: id, title, messages }] : [];
  });
}

/**
 * The required documents with no file yet, in the words the server's submit
 * refuses with (`ApplicantIntake::assertSubmittable()`), or null.
 */
export function missingDocumentsMessage(documents: readonly PublicDocument[]): string | null {
  const missing = documents.filter((d) => d.required && !d.file_name).map((d) => d.label.toLowerCase());
  return missing.length > 0 ? `Upload your ${missing.join(" and ")}.` : null;
}

/**
 * The open step's errors once the server answers again (an autosave, or a
 * file changed): each one it still names, in its current words. One it no
 * longer names is fixed and goes at once; nothing new shows before Next.
 */
export function errorsAfterSave(
  step: WizardStepId,
  errors: WizardErrors,
  state: Pick<PublicApplicationState, "missing_fields" | "documents">,
): WizardErrors {
  const documents = step === "documents" ? missingDocumentsMessage(state.documents) : null;
  const current: WizardErrors = step === "documents" ? (documents ? { documents } : {}) : stepErrors(step, state.missing_fields);
  return Object.fromEntries(Object.keys(errors).flatMap((field) => (current[field] ? [[field, current[field]]] : [])));
}

/** Where a resumed application opens: the step after the server's last completed one, never before Personal details. */
export function resumeStepIndex(lastCompletedStep: string | null): number {
  const done = WIZARD_STEPS.findIndex((s) => s.id === lastCompletedStep);
  return Math.min(Math.max(done + 1, 2), WIZARD_STEPS.length - 1);
}

/**
 * The draft once the code is verified: the server's (a mobile's open draft
 * comes back as it was saved), with the product the applicant just chose, and
 * the link's only branch when it offers one.
 */
export function draftAfterVerify(
  local: ApplicationDraft,
  server: ApplicationDraft | null | undefined,
  branches: readonly { id: number }[],
): ApplicationDraft {
  const draft = mergeDraft(server);
  const chosen = local.loan.loan_product_id;
  const loan =
    chosen !== null && chosen !== draft.loan.loan_product_id
      ? { ...draft.loan, loan_product_id: chosen, frequency: local.loan.frequency }
      : draft.loan;
  const personal =
    draft.personal.branch_id === null && branches.length === 1 ? { ...draft.personal, branch_id: branches[0].id } : draft.personal;
  return { ...draft, loan, personal };
}

/**
 * A typed peso amount as the server reads it (`DraftRules::decimal()`):
 * commas, spaces and ₱ ignored, at most two decimals. The text itself, never
 * a number, so nothing is lost on the way.
 */
export function typedAmount(value: string): string | null {
  const cleaned = value.replace(/[,\s₱]/gu, "");
  return /^\d{1,13}(\.\d{1,2})?$/.test(cleaned) ? cleaned : null;
}

/**
 * The estimate to ask for once the product, an amount, a whole term and a
 * schedule are given; the server checks them against the product and answers
 * in words. A product with one schedule lets the server choose it.
 */
export function estimateRequest(loan: ApplicantLoanRequest, product: PublicProduct | undefined): EstimateRequest | null {
  if (!product || loan.loan_product_id !== product.id) return null;
  const amount = typedAmount(loan.amount);
  const term = loan.term.trim();
  if (amount === null || !/^\d{1,5}$/.test(term) || Number(term) < 1) return null;
  if (!loan.frequency && product.payment_frequencies.length > 1) return null;
  return { loan_product_id: product.id, amount, term: Number(term), frequency: loan.frequency || null };
}
