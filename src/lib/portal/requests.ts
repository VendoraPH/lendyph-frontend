import { formatCurrency } from "@/lib/format";
import type {
  LoanApplicationStatus,
  PortalDocumentCategory,
  PortalFeatures,
  PortalLoanProduct,
  PortalRequestStatus,
  PortalRequestType,
  PortalSavingsAccount,
  SigningStatus,
  StaffRequestDecision,
} from "@/types/portal";
import { toAmount } from "./finance";
import type { Tone } from "./labels";

// ── Request types ──────────────────────────────────────────────────────────

/** How a request field is entered. The pickers list the member's own records. */
export type RequestFieldKind =
  | "text"
  | "textarea"
  | "amount"
  | "select"
  | "confirm"
  | "loan"
  | "savings_account"
  | "time_deposit"
  | "savings_product";

export interface RequestField {
  key: string;
  label: string;
  kind: RequestFieldKind;
  required?: boolean;
  options?: { value: string; label: string }[];
  /** Only asked when another field has one of these values. */
  showIf?: { key: string; values: string[] };
  hint?: string;
}

export interface RequestTypeDef {
  label: string;
  description: string;
  /** Offered only when every one of these member services is switched on. */
  features: (keyof PortalFeatures)[];
  fields: RequestField[];
  attachments: boolean;
}

const DISBURSEMENT = [
  { value: "gcash", label: "GCash" },
  { value: "bank", label: "Bank transfer" },
  { value: "cash_pickup", label: "Cash pickup at the branch" },
];

export const REQUEST_TYPES: Record<PortalRequestType, RequestTypeDef> = {
  savings_withdrawal: {
    label: "Savings withdrawal",
    description: "Withdraw from a savings account. Funds are released once the cooperative approves.",
    features: ["savings", "withdrawal_requests"],
    attachments: false,
    fields: [
      { key: "account_id", label: "Account", kind: "savings_account", required: true },
      { key: "amount", label: "Amount", kind: "amount", required: true },
      { key: "disbursement_method", label: "Receive it by", kind: "select", required: true, options: DISBURSEMENT },
      {
        key: "gcash_number",
        label: "GCash number",
        kind: "text",
        required: true,
        showIf: { key: "disbursement_method", values: ["gcash"] },
      },
      { key: "bank_name", label: "Bank", kind: "text", required: true, showIf: { key: "disbursement_method", values: ["bank"] } },
      {
        key: "bank_account_name",
        label: "Account name",
        kind: "text",
        required: true,
        showIf: { key: "disbursement_method", values: ["bank"] },
      },
      {
        key: "bank_account_number",
        label: "Account number",
        kind: "text",
        required: true,
        showIf: { key: "disbursement_method", values: ["bank"] },
      },
    ],
  },
  savings_opening: {
    label: "Open a savings account",
    description: "Choose a savings product and your first deposit. Staff open the account after review.",
    features: ["savings"],
    attachments: false,
    fields: [
      { key: "product_id", label: "Product", kind: "savings_product", required: true },
      { key: "initial_deposit", label: "Initial deposit", kind: "amount", required: true },
      { key: "terms_accepted", label: "I have read the product's terms", kind: "confirm", required: true },
    ],
  },
  time_deposit_instruction: {
    label: "Time deposit maturity instruction",
    description: "Tell the cooperative what to do with a time deposit when it matures.",
    features: ["time_deposits"],
    attachments: false,
    fields: [
      { key: "time_deposit_id", label: "Time deposit", kind: "time_deposit", required: true },
      {
        key: "instruction",
        label: "At maturity",
        kind: "select",
        required: true,
        options: [
          { value: "renew_principal", label: "Renew the principal, pay out the interest" },
          { value: "renew_with_interest", label: "Renew the principal and interest" },
          { value: "credit_to_savings", label: "Credit everything to my savings" },
          { value: "payout", label: "Pay everything out" },
        ],
      },
      {
        key: "savings_account_id",
        label: "Savings account",
        kind: "savings_account",
        required: true,
        showIf: { key: "instruction", values: ["credit_to_savings"] },
      },
    ],
  },
  loan_restructure: {
    label: "Loan restructuring",
    description: "Ask for a new payment arrangement. The cooperative reviews it through its restructuring process.",
    features: ["loans"],
    attachments: true,
    fields: [
      { key: "loan_id", label: "Loan", kind: "loan", required: true },
      { key: "reason", label: "Why you need a new arrangement", kind: "textarea", required: true },
      {
        key: "requested_arrangement",
        label: "Arrangement you are asking for",
        kind: "textarea",
        required: true,
        hint: "For example: a longer term, or a lower amortization for six months.",
      },
    ],
  },
  document_request: {
    label: "Document request",
    description: "Ask for a certificate or a copy of a document.",
    features: ["documents"],
    attachments: false,
    fields: [
      {
        key: "document_type",
        label: "Document",
        kind: "select",
        required: true,
        options: [
          { value: "membership_certificate", label: "Certificate of membership" },
          { value: "share_capital_certificate", label: "Share capital certificate" },
          { value: "loan_statement", label: "Loan statement" },
          { value: "member_ledger_card", label: "Member ledger card" },
          { value: "other", label: "Something else" },
        ],
      },
      { key: "purpose", label: "What you need it for", kind: "text", required: true },
    ],
  },
  membership_concern: {
    label: "Membership concern",
    description: "Raise a question or concern about your membership.",
    features: [],
    attachments: true,
    fields: [
      { key: "subject", label: "Subject", kind: "text", required: true },
      { key: "message", label: "Message", kind: "textarea", required: true },
    ],
  },
  account_closure: {
    label: "Account closure",
    description: "Close a savings account or withdraw from membership. Staff will contact you first.",
    features: [],
    attachments: false,
    fields: [
      {
        key: "close",
        label: "Close",
        kind: "select",
        required: true,
        options: [
          { value: "savings_account", label: "A savings account" },
          { value: "membership", label: "My membership" },
        ],
      },
      {
        key: "savings_account_id",
        label: "Savings account",
        kind: "savings_account",
        required: true,
        showIf: { key: "close", values: ["savings_account"] },
      },
      { key: "reason", label: "Reason", kind: "textarea", required: true },
    ],
  },
  other: {
    label: "Something else",
    description: "Any other request for the cooperative.",
    features: [],
    attachments: true,
    fields: [
      { key: "subject", label: "Subject", kind: "text", required: true },
      { key: "message", label: "Message", kind: "textarea", required: true },
    ],
  },
};

/** The request types this portal's settings allow. */
export function requestTypesFor(features: PortalFeatures): PortalRequestType[] {
  return (Object.keys(REQUEST_TYPES) as PortalRequestType[]).filter((type) =>
    REQUEST_TYPES[type].features.every((f) => features[f] !== false),
  );
}

/** Whether a field is asked, given what the member has entered so far. */
export function fieldVisible(field: RequestField, values: Record<string, string>): boolean {
  return !field.showIf || field.showIf.values.includes(values[field.showIf.key] ?? "");
}

/** The details to send: only visible fields, trimmed, with blanks left out. */
export function requestDetails(type: PortalRequestType, values: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const field of REQUEST_TYPES[type].fields) {
    const value = (values[field.key] ?? "").trim();
    if (value && fieldVisible(field, values)) out[field.key] = value;
  }
  return out;
}

/** Labels of required, visible fields still empty. */
export function missingRequestFields(type: PortalRequestType, values: Record<string, string>): string[] {
  return REQUEST_TYPES[type].fields
    .filter((f) => f.required && fieldVisible(f, values) && !(values[f.key] ?? "").trim())
    .map((f) => f.label);
}

/** A typed amount, or NaN when it is not a plain number. */
export function parseAmount(text: string): number {
  const clean = text.replace(/,/g, "").trim();
  return /^\d+(\.\d+)?$/.test(clean) ? Number(clean) : NaN;
}

export function amountProblem(amount: number, min = 0, max = Infinity): string | null {
  if (!Number.isFinite(amount) || amount <= 0) return "Enter an amount.";
  if (Math.round(amount * 100) !== amount * 100) return "Use at most two decimal places.";
  if (amount < min) return `The smallest amount is ${formatCurrency(min)}.`;
  if (amount > max) return `The largest amount is ${formatCurrency(max)}.`;
  return null;
}

/**
 * The most a member may withdraw now. The server's `withdrawable` wins; without
 * it, the available balance less the maintaining balance.
 */
export function maxWithdrawable(account: PortalSavingsAccount): number {
  if (account.withdrawable != null) return Math.max(0, toAmount(account.withdrawable));
  return Math.max(0, toAmount(account.available_balance) - toAmount(account.maintaining_balance));
}

export function withdrawalProblem(amount: number, account: PortalSavingsAccount): string | null {
  const max = maxWithdrawable(account);
  if (max <= 0) return "This account has nothing available to withdraw right now.";
  const problem = amountProblem(amount);
  if (problem) return problem;
  if (amount > max) return "The amount is more than you can withdraw from this account.";
  return null;
}

// ── Attachments ────────────────────────────────────────────────────────────

export const MAX_ATTACHMENT_MB = 10;
export const MAX_ATTACHMENTS = 5;
export const ATTACHMENT_ACCEPT = ".pdf,.jpg,.jpeg,.png";

export function attachmentProblem(files: { name: string; size: number }[]): string | null {
  if (files.length > MAX_ATTACHMENTS) return `Attach at most ${MAX_ATTACHMENTS} files.`;
  for (const f of files) {
    if (!/\.(pdf|jpe?g|png)$/i.test(f.name)) return `${f.name} is not a PDF or an image.`;
    if (f.size > MAX_ATTACHMENT_MB * 1024 * 1024) return `${f.name} is larger than ${MAX_ATTACHMENT_MB} MB.`;
  }
  return null;
}

// ── Statuses and labels ────────────────────────────────────────────────────

export const PORTAL_REQUEST_STATUS: Record<PortalRequestStatus, { label: string; tone: Tone }> = {
  submitted: { label: "Submitted", tone: "info" },
  under_review: { label: "Under review", tone: "info" },
  need_info: { label: "More information needed", tone: "warning" },
  approved: { label: "Approved", tone: "success" },
  rejected: { label: "Not approved", tone: "danger" },
  completed: { label: "Completed", tone: "success" },
  cancelled: { label: "Cancelled", tone: "muted" },
};

export const APPLICATION_STATUS: Record<LoanApplicationStatus, { label: string; tone: Tone }> = {
  submitted: { label: "Submitted", tone: "info" },
  document_review: { label: "Document review", tone: "info" },
  credit_assessment: { label: "Credit assessment", tone: "info" },
  for_approval: { label: "For approval", tone: "info" },
  approved: { label: "Approved", tone: "success" },
  for_release: { label: "For release", tone: "success" },
  released: { label: "Released", tone: "success" },
  rejected: { label: "Not approved", tone: "danger" },
  cancelled: { label: "Cancelled", tone: "muted" },
};

export const DOCUMENT_CATEGORIES: Record<PortalDocumentCategory, string> = {
  membership: "Membership",
  loans: "Loans",
  share_capital: "Share capital",
  savings: "Savings",
  payments: "Payments",
  other: "Other",
};

export const SIGNING_STATUS: Record<SigningStatus, { label: string; tone: Tone } | null> = {
  not_required: null,
  for_signature: { label: "For signature", tone: "warning" },
  signed: { label: "Signed", tone: "success" },
  expired: { label: "Expired", tone: "danger" },
  replaced: { label: "Replaced", tone: "muted" },
};

/** A member may withdraw a request or application only before review starts. */
export function canCancel(status: string): boolean {
  return status === "submitted";
}

// ── Staff decisions ────────────────────────────────────────────────────────

export const DECISION_LABEL: Record<StaffRequestDecision, string> = {
  under_review: "Start review",
  need_info: "Ask for information",
  approve: "Approve",
  reject: "Reject",
  complete: "Mark completed",
};

/** What staff may do next with a request in this status; closed requests get nothing. */
export function allowedDecisions(status: PortalRequestStatus): StaffRequestDecision[] {
  switch (status) {
    case "submitted":
      return ["under_review", "need_info", "approve", "reject"];
    case "under_review":
    case "need_info":
      return ["need_info", "approve", "reject"];
    case "approved":
      return ["complete"];
    default:
      return [];
  }
}

/** The member must be told why: asking for information or rejecting needs a reply. */
export function decisionNeedsResponse(decision: StaffRequestDecision): boolean {
  return decision === "need_info" || decision === "reject";
}

// ── Loan application ───────────────────────────────────────────────────────

export type ApplicationStep = "product" | "loan" | "income" | "collateral" | "documents" | "review";

export const STEP_LABELS: Record<ApplicationStep, string> = {
  product: "Product",
  loan: "Amount and term",
  income: "Income",
  collateral: "Collateral",
  documents: "Documents",
  review: "Review",
};

export interface ApplicationDraft {
  amount: string;
  term: string;
  purpose: string;
  monthly_income: string;
  other_income: string;
  monthly_expenses: string;
  income_source: string;
  collateral_description: string;
  collateral_value: string;
  documents: Record<string, File | undefined>;
  declaration: boolean;
}

export const EMPTY_DRAFT: ApplicationDraft = {
  amount: "",
  term: "",
  purpose: "",
  monthly_income: "",
  other_income: "",
  monthly_expenses: "",
  income_source: "",
  collateral_description: "",
  collateral_value: "",
  documents: {},
  declaration: false,
};

/** The steps this product needs, in order. */
export function applicationSteps(product: PortalLoanProduct | null): ApplicationStep[] {
  const steps: ApplicationStep[] = ["product", "loan"];
  if (product?.requires_income_info) steps.push("income");
  if (product?.requires_collateral) steps.push("collateral");
  if (product && product.required_documents.length > 0) steps.push("documents");
  steps.push("review");
  return steps;
}

function optionalAmountProblem(text: string, label: string): string | null {
  if (!text.trim()) return null;
  const n = parseAmount(text);
  return Number.isFinite(n) && n >= 0 ? null : `${label} must be an amount.`;
}

/** What stops the member leaving this step, or null. */
export function stepProblem(
  step: ApplicationStep,
  draft: ApplicationDraft,
  product: PortalLoanProduct | null,
): string | null {
  if (!product) return "Choose a loan product.";
  switch (step) {
    case "product":
      return null;
    case "loan": {
      const amount = amountProblem(parseAmount(draft.amount), toAmount(product.min_amount), toAmount(product.max_amount));
      if (amount) return amount;
      const term = Number(draft.term);
      if (!Number.isInteger(term) || term < product.min_term || term > product.max_term) {
        return `Choose a term from ${product.min_term} to ${product.max_term} ${product.term_unit}.`;
      }
      if (!draft.purpose.trim()) return "Tell us what the loan is for.";
      return null;
    }
    case "income": {
      const income = parseAmount(draft.monthly_income);
      if (!Number.isFinite(income) || income <= 0) return "Enter your monthly income.";
      return (
        optionalAmountProblem(draft.other_income, "Other income") ??
        optionalAmountProblem(draft.monthly_expenses, "Monthly expenses")
      );
    }
    case "collateral":
      if (!draft.collateral_description.trim()) return "Describe the collateral you are offering.";
      return optionalAmountProblem(draft.collateral_value, "Estimated value");
    case "documents": {
      const missing = product.required_documents.find((name) => !draft.documents[name]);
      if (missing) return `Attach your ${missing}.`;
      return attachmentProblem(Object.values(draft.documents).filter((f): f is File => !!f));
    }
    case "review":
      return draft.declaration ? null : "Confirm the declaration to submit.";
  }
}
