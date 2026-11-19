import { VALID_ID_OPTIONS } from "@/constants";
import { formatDate, formatDateTime } from "@/lib/format";
import { amlaSubjectHref } from "@/lib/amla/cdd-access";
import type { AmlaOption } from "@/lib/amla/settings-view";
import type {
  AmlaCddProfile,
  AmlaCddRow,
  AmlaCompleteness,
  AmlaCompletenessItem,
  AmlaIdVerificationBody,
  AmlaMemberIdDocument,
  AmlaProfileBody,
  AmlaProfileChange,
  AmlaReviewBody,
  AmlaRiskAssessment,
  AmlaRiskAssessmentBody,
  AmlaRiskLevel,
  AmlaSubjectType,
} from "@/types/amla-cdd";

/**
 * AMLA customer due diligence in words (Phase 6, AMLA-B4). The server works
 * out every status, score, level and review date; these helpers only word
 * them, and check the forms for what is plainly missing before the server
 * decides.
 */

/** `CddState::STATUSES`, in its order. */
export const AMLA_CDD_STATUS_OPTIONS: readonly AmlaOption[] = [
  { value: "not_started", label: "Not Started" },
  { value: "pending_verification", label: "Pending Verification" },
  { value: "verified", label: "Verified" },
  { value: "additional_info_required", label: "Additional Information Required" },
  { value: "edd_required", label: "Enhanced Due Diligence Required" },
  { value: "review_overdue", label: "Review Overdue" },
];

/** `AmlaRiskAssessment::LEVELS`. */
export const AMLA_RISK_LEVEL_OPTIONS: readonly { value: AmlaRiskLevel; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

/** `SavingsAccount::SOURCES_OF_FUNDS`. */
export const AMLA_SOURCE_OF_FUNDS_OPTIONS: readonly AmlaOption[] = [
  { value: "salary", label: "Salary" },
  { value: "business", label: "Business" },
  { value: "remittance", label: "Remittance" },
  { value: "pension", label: "Pension" },
  { value: "savings", label: "Savings" },
  { value: "other", label: "Other" },
];

/** `AmlaProfile::PEP_STATUSES`. */
export const AMLA_PEP_STATUS_OPTIONS: readonly AmlaOption[] = [
  { value: "not_pep", label: "Not a politically exposed person" },
  { value: "pep", label: "Politically exposed person" },
  { value: "pep_family", label: "Family member of a politically exposed person" },
  { value: "pep_associate", label: "Close associate of a politically exposed person" },
];

/** `AmlaIdVerification::METHODS` and `RESULTS`. */
export const AMLA_ID_METHOD_OPTIONS: readonly AmlaOption[] = [
  { value: "original_seen", label: "Original ID seen in person" },
  { value: "certified_copy", label: "Certified true copy" },
  { value: "copy_only", label: "Photocopy or scan only" },
];
export const AMLA_ID_RESULT_OPTIONS: readonly AmlaOption[] = [
  { value: "verified", label: "Verified" },
  { value: "failed", label: "Could not be verified" },
];

/** `AmlaReview::KINDS` and `OUTCOMES`. */
export const AMLA_REVIEW_KIND_OPTIONS: readonly AmlaOption[] = [
  { value: "periodic", label: "Periodic review" },
  { value: "edd", label: "Enhanced due diligence" },
  { value: "trigger", label: "Change in circumstances" },
];
export const AMLA_REVIEW_OUTCOME_OPTIONS: readonly AmlaOption[] = [
  { value: "no_change", label: "No change" },
  { value: "updated", label: "Profile updated" },
  { value: "escalated", label: "Escalated for investigation" },
];

export type AmlaBadgeTone = "default" | "secondary" | "destructive" | "outline";

const STATUS_TONES: Readonly<Record<string, AmlaBadgeTone>> = {
  review_overdue: "destructive",
  edd_required: "destructive",
  additional_info_required: "secondary",
  pending_verification: "secondary",
  verified: "default",
  not_started: "outline",
};

export function amlaCddStatusTone(status: string): AmlaBadgeTone {
  return Object.hasOwn(STATUS_TONES, status) ? STATUS_TONES[status] : "outline";
}

const REASON_MAX = 1000;
type Result<T> = { body: T } | { error: string };

export interface AmlaWorklistRow {
  key: string;
  href: string;
  name: string;
  code: string;
  type: string;
  branch: string;
  imported: boolean;
  status: string;
  tone: AmlaBadgeTone;
  risk: string;
  nextReview: string;
  missing: string;
}

/** Multi-branch decision 6: no branch reads "Organisation-wide" (walk-ins carry none). */
export const NO_BRANCH = "Organisation-wide";

export function amlaWorklistRow(row: AmlaCddRow): AmlaWorklistRow {
  const walkIn = row.type === "walk_in";
  return {
    key: `${row.type}-${row.id}`,
    href: amlaSubjectHref(row.type, row.id),
    name: row.name,
    code: row.code ?? "—",
    type: walkIn ? "Walk-in" : "Member",
    branch: row.branch?.name ?? NO_BRANCH,
    imported: row.is_imported,
    status: row.cdd_status_words,
    tone: amlaCddStatusTone(row.cdd_status),
    risk: row.risk_level_words ?? "Not assessed yet",
    nextReview: row.next_review_on ? formatDate(row.next_review_on) : "Not set",
    missing: row.missing_count === 0 ? "Complete" : `${row.missing_count} ${row.missing_count === 1 ? "item" : "items"} missing`,
  };
}

export function amlaCompletenessLines(completeness: AmlaCompleteness): { complete: string | null; items: string[] } {
  const items = [...completeness.missing, ...completeness.expired, ...completeness.expiring_soon].map((item) => item.words);
  return {
    complete: completeness.complete && completeness.missing.length === 0 ? "Everything CDD needs is on file." : null,
    items,
  };
}

export interface AmlaFactorRow {
  key: string;
  label: string;
  value: string;
  points: string;
  notAvailable: boolean;
}

/** The subject a factor list is read for, so a value the server took from elsewhere can say where from. */
export interface AmlaFactorContext {
  type: AmlaSubjectType;
  profile: Pick<AmlaCddProfile, "occupation">;
}

/**
 * The scorer counts a member's occupation as provided when the AMLA profile
 * has none but the member's record names an employer or business
 * (`RiskScorer`, `CddState`), so the factor says where it came from.
 */
function fromMemberRecord(factor: { key: string; value: string }, context: AmlaFactorContext | undefined): boolean {
  return factor.key === "occupation" && factor.value === "provided" && context?.type === "member" && !context.profile.occupation;
}

export function amlaFactorRows(assessment: AmlaRiskAssessment, context?: AmlaFactorContext): AmlaFactorRow[] {
  return assessment.factors.map((factor) => {
    const notAvailable = factor.value === "not_available";
    return {
      key: factor.key,
      label: factor.label,
      value: fromMemberRecord(factor, context) ? `${factor.value_words}, from the member's record` : factor.value_words,
      points: notAvailable ? "—" : `${factor.points} ${factor.points === 1 ? "point" : "points"}`,
      notAvailable,
    };
  });
}

export function amlaRiskSummary(assessment: AmlaRiskAssessment): {
  level: string;
  score: string;
  override: string | null;
  rules: string;
  assessed: string;
} {
  let override: string | null = null;
  if (assessment.overridden) {
    override = `Overridden from ${assessment.computed_level_words}${assessment.override_carried ? ", carried from the last assessment" : ""}.`;
    if (assessment.override_reason) override += ` Reason: ${assessment.override_reason}`;
  }
  const version = assessment.rule_version === null ? "Rules" : `Rules version ${assessment.rule_version}`;
  return {
    level: assessment.level_words,
    score: `Score ${assessment.score}`,
    override,
    rules: assessment.rules_to_verify ? `${version}, still to verify` : version,
    assessed: `${assessment.trigger_words} by ${assessment.assessed_by?.name ?? "the system"}, ${formatDateTime(assessment.assessed_at)}`,
  };
}

/** Assess now (no override), or override to a level with a reason. */
export function amlaAssessBody(form: { level: string; reason: string }): Result<AmlaRiskAssessmentBody> {
  const reason = form.reason.trim();
  if (form.level === "") {
    return reason === "" ? { body: {} } : { error: "Pick the level to override to, or clear the reason." };
  }
  if (reason === "") return { error: "Give the reason for the override." };
  if (reason.length > REASON_MAX) return { error: "Keep the reason to 1,000 characters." };
  return { body: { override_level: form.level as AmlaRiskLevel, override_reason: reason } };
}

export interface AmlaProfileDraft {
  nationality: string;
  occupation: string;
  source_of_funds: string;
  source_of_funds_other: string;
  purpose: string;
  expected_monthly_amount: string;
  expected_monthly_count: string;
  pep_status: string;
  pep_details: string;
  /** "yes", "no", or "" when not answered. */
  adverse_info: string;
  adverse_info_note: string;
}

export function amlaProfileDraft(profile: AmlaCddProfile): AmlaProfileDraft {
  return {
    nationality: profile.nationality ?? "",
    occupation: profile.occupation ?? "",
    source_of_funds: profile.source_of_funds ?? "",
    source_of_funds_other: profile.source_of_funds_other ?? "",
    purpose: profile.purpose ?? "",
    expected_monthly_amount: profile.expected_monthly_amount ?? "",
    expected_monthly_count: profile.expected_monthly_count === null ? "" : String(profile.expected_monthly_count),
    pep_status: profile.pep_status ?? "",
    pep_details: profile.pep_details ?? "",
    adverse_info: profile.adverse_info === null ? "" : profile.adverse_info ? "yes" : "no",
    adverse_info_note: profile.adverse_info_note ?? "",
  };
}

const PESO = /^\d+(\.\d{1,2})?$/;
const WHOLE = /^\d+$/;
const COUNTRY = /^[A-Z]{2}$/;
const TEXT_FIELDS = ["occupation", "purpose", "pep_details", "adverse_info_note"] as const;
const PICK_FIELDS = ["source_of_funds", "pep_status"] as const;

function orNull(value: string): string | null {
  return value === "" ? null : value;
}

/**
 * The answers that changed, trimmed; a cleared answer is sent as empty. An
 * unchanged form sends nothing and says so, as the server would write nothing.
 */
export function amlaProfileBody(profile: AmlaCddProfile, draft: AmlaProfileDraft): Result<AmlaProfileBody> | { unchanged: string } {
  const nationality = draft.nationality.trim().toUpperCase();
  if (nationality !== "" && !COUNTRY.test(nationality)) return { error: "The nationality is a two-letter country code, such as PH." };
  const amount = draft.expected_monthly_amount.trim();
  if (amount !== "" && !PESO.test(amount)) {
    return { error: "The expected monthly amount is in pesos with up to two decimals, such as 15000.00." };
  }
  const count = draft.expected_monthly_count.trim();
  if (count !== "" && !WHOLE.test(count)) return { error: "The expected number of transactions a month is a whole number." };
  const other = draft.source_of_funds === "other" ? draft.source_of_funds_other.trim() : "";
  if (draft.source_of_funds === "other" && other === "") return { error: "Say what the other source of funds is." };

  const body: AmlaProfileBody = {};
  if (nationality !== (profile.nationality ?? "")) body.nationality = orNull(nationality);
  for (const key of TEXT_FIELDS) {
    const value = draft[key].trim();
    if (value !== (profile[key] ?? "")) body[key] = orNull(value);
  }
  for (const key of PICK_FIELDS) {
    if (draft[key] !== (profile[key] ?? "")) body[key] = orNull(draft[key]);
  }
  if (other !== (profile.source_of_funds_other ?? "")) body.source_of_funds_other = orNull(other);
  if (amount !== (profile.expected_monthly_amount ?? "")) body.expected_monthly_amount = orNull(amount);
  if (count !== (profile.expected_monthly_count === null ? "" : String(profile.expected_monthly_count))) {
    body.expected_monthly_count = count === "" ? null : Number(count);
  }
  const adverse = draft.adverse_info === "" ? null : draft.adverse_info === "yes";
  if (adverse !== profile.adverse_info) body.adverse_info = adverse;

  return Object.keys(body).length === 0 ? { unchanged: "Nothing changed, so nothing was saved." } : { body };
}

const ID_TYPE_WORDS: Readonly<Record<string, string>> = Object.fromEntries(VALID_ID_OPTIONS.map((o) => [o.value, o.label]));
const CUSTOM_NAME_MAX = 100;

/** `IdTypes::fromDocument`: the type in words, never free text that could hold a number. */
function idTypeWords(label: string | null | undefined, customName: string | null | undefined): string {
  const key = label ?? "";
  if (key !== "others") return key !== "" && Object.hasOwn(ID_TYPE_WORDS, key) ? ID_TYPE_WORDS[key] : "Others";
  const name = (customName ?? "").trim();
  return name !== "" && name.length <= CUSTOM_NAME_MAX && !/\d/.test(name) ? name : "Others";
}

/**
 * A member's own valid IDs to pick from, by type and last four characters only
 * (spaces and dashes ignored, as the server keeps them). The whole number is
 * never put in a label.
 */
export function amlaIdDocumentOptions(documents: AmlaMemberIdDocument[]): AmlaOption[] {
  return documents.flatMap((doc) => {
    if (doc.type !== "valid_id") return [];
    const number = (doc.id_number ?? "").replace(/[\s-]/g, "").toUpperCase();
    if (number === "") return [];
    const side = doc.side === "front" || doc.side === "back" ? ` (${doc.side})` : "";
    return [{ value: String(doc.id), label: `${idTypeWords(doc.label, doc.custom_type_name)} ****${number.slice(-4)}${side}` }];
  });
}

export interface AmlaIdVerificationForm {
  documentId: string;
  method: string;
  result: string;
  expiresOn: string;
  notes: string;
}

export function amlaIdVerificationBody(type: AmlaSubjectType, form: AmlaIdVerificationForm): Result<AmlaIdVerificationBody> {
  if (type === "member" && form.documentId === "") return { error: "Pick one of the member's own valid IDs." };
  if (form.method === "") return { error: "Pick how the ID was checked." };
  if (form.result === "") return { error: "Pick the result." };
  if (form.method === "copy_only" && form.result === "verified") {
    return { error: "A photocopy or scan alone never verifies an ID. Record it as could not be verified, or check the original." };
  }
  const notes = form.notes.trim();
  return {
    body: {
      ...(type === "member" ? { document_id: Number(form.documentId) } : {}),
      method: form.method,
      result: form.result,
      ...(form.expiresOn !== "" ? { expires_on: form.expiresOn } : {}),
      ...(notes !== "" ? { notes } : {}),
    },
  };
}

export function amlaReviewBody(form: { kind: string; outcome: string; notes: string }): Result<AmlaReviewBody> {
  if (form.kind === "") return { error: "Pick the kind of review." };
  if (form.outcome === "") return { error: "Pick the outcome." };
  const notes = form.notes.trim();
  if (form.kind === "edd" && notes === "") return { error: "An enhanced due diligence review needs notes." };
  return { body: { kind: form.kind, outcome: form.outcome, ...(notes !== "" ? { notes } : {}) } };
}

/**
 * The occupation answer. When the AMLA profile has none but the completeness
 * check doesn't list it as missing, a member's record names an employer or
 * business (the server's rule), so the answer says so instead of reading
 * "Not answered" beside a factor that reads "Provided".
 */
export function amlaOccupationAnswer(
  type: AmlaSubjectType,
  profile: Pick<AmlaCddProfile, "occupation">,
  missing: AmlaCompletenessItem[],
): string {
  if (profile.occupation) return profile.occupation;
  if (type === "member" && !missing.some((item) => item.key === "occupation")) {
    return "Not answered here. The member's record names an employer or business.";
  }
  return "Not answered";
}

/**
 * When the answers last changed: the newest change to an answer (the history
 * comes newest first). The profile's own `updated_at` also moves on reviews and
 * overrides, so it isn't used.
 */
export function amlaAnswersChangedText(profile: AmlaCddProfile, changes: AmlaProfileChange[]): string {
  if (!profile.exists) return "Not started. The first save starts the profile.";
  const latest = changes[0];
  if (!latest) return "No answers saved yet.";
  return `Answers last changed ${formatDateTime(latest.changed_at)} by ${latest.changed_by?.name ?? "the system"}.`;
}

export function amlaReviewLines(profile: AmlaCddProfile): { next: string; last: string; edd: string | null } {
  return {
    next: profile.next_review_on ? `Next review ${formatDate(profile.next_review_on)}` : "No review scheduled yet",
    last: profile.last_review_on ? `Last reviewed ${formatDate(profile.last_review_on)}` : "Not reviewed yet",
    edd: profile.edd_required
      ? profile.edd_completed
        ? "Enhanced due diligence is done."
        : "Enhanced due diligence is required and not yet done."
      : null,
  };
}

/** `AmlaProfile::KYC_FIELDS` in words. */
const FIELD_WORDS: Readonly<Record<string, string>> = {
  nationality: "Nationality",
  occupation: "Occupation or business",
  source_of_funds: "Source of funds",
  source_of_funds_other: "Other source of funds",
  purpose: "Purpose of the relationship",
  expected_monthly_centavos: "Expected monthly amount",
  expected_monthly_count: "Expected transactions a month",
  pep_status: "PEP status",
  pep_details: "PEP details",
  adverse_info: "Adverse information",
  adverse_info_note: "Adverse information note",
};

/** A profile change by the fields it changed, in words. Its old and new values are never listed. */
export function amlaProfileChangeRow(change: AmlaProfileChange): { id: number; fields: string; who: string; when: string } {
  const words = [...new Set(change.fields.map((field) => (Object.hasOwn(FIELD_WORDS, field) ? FIELD_WORDS[field] : "Another answer")))];
  return {
    id: change.id,
    fields: words.join(", "),
    who: change.changed_by?.name ?? "the system",
    when: formatDateTime(change.changed_at),
  };
}
