import type { ApplicationDraft, IncomeSource } from "@/types/loan-origination";

/**
 * Which Income step fields show. Each income source has its own fields (the
 * server's own rules, `DraftRules::employmentErrors()`, ask for these and no
 * others). A product's settings can require any field of the form, and the
 * server names a blank one in `missing_fields`; such a field shows whatever
 * the source, so the applicant can always fill what is asked for. Optional
 * fields of another source stay hidden.
 */

export const EMPLOYED_FIELDS = [
  "employer_name",
  "job_title",
  "employment_type",
  "years_employed",
  "gross_monthly_income",
  "net_monthly_income",
  "salary_frequency",
  "employer_address",
] as const;

export const BUSINESS_FIELDS = [
  "business_name",
  "business_type",
  "years_operating",
  "business_address",
  "monthly_revenue",
  "monthly_business_expenses",
  "monthly_net_business_income",
] as const;

export const OTHER_SOURCE_FIELDS = ["other_source_description", "other_income_amount", "other_income_frequency", "other_income_details"] as const;

const OWN_FIELDS: Record<IncomeSource, readonly string[]> = {
  employed: [...EMPLOYED_FIELDS, "other_regular_income"],
  self_employed: [...BUSINESS_FIELDS, "other_regular_income"],
  business_owner: [...BUSINESS_FIELDS, "other_regular_income"],
  farmer: [...OTHER_SOURCE_FIELDS, "other_regular_income"],
  pensioner: [...OTHER_SOURCE_FIELDS, "other_regular_income"],
  other: [...OTHER_SOURCE_FIELDS, "other_regular_income"],
};

const ownFields = (source: IncomeSource | ""): readonly string[] => (source ? OWN_FIELDS[source] : []);

/** The Income step field a setting (`employment.x`) or a server key (`draft.employment.x`) names; the source picker always shows. */
function employmentField(key: string): string | null {
  const match = /^(?:draft\.)?employment\.([a-z_]+)$/.exec(key);
  return match && match[1] !== "income_source" ? match[1] : null;
}

/** The fields asked for whatever the source: the product's required fields, and every field `missing_fields` names. */
export function askedFields(requiredFields: readonly string[], missingFields: Record<string, string>): Set<string> {
  const asked = new Set<string>();
  for (const key of [...requiredFields, ...Object.keys(missingFields)]) {
    const field = employmentField(key);
    if (field) asked.add(field);
  }
  return asked;
}

/** The fields to show: the source's own, optional ones included, and every field asked for. */
export function visibleFields(
  incomeSource: IncomeSource | "",
  requiredFields: readonly string[],
  missingFields: Record<string, string>,
): Set<string> {
  return new Set([...ownFields(incomeSource), ...askedFields(requiredFields, missingFields)]);
}

type ServerView = { draft: ApplicationDraft; missing_fields: Record<string, string>; required_fields?: string[] };

/** The server's missing fields describe the draft it saved: while the source has changed since, they wait for the next save. */
export function missingForSource(state: ServerView | null, incomeSource: IncomeSource | ""): Record<string, string> {
  return state && state.draft.employment.income_source === incomeSource ? state.missing_fields : {};
}

/** The product's required fields, as far as the server has named them. */
export interface RequiredMemory {
  productId: number | null;
  /** As the settings name them (`employment.employer_name`). */
  fields: string[];
}

export const NOTHING_REQUIRED: RequiredMemory = { productId: null, fields: [] };

/**
 * The product's required fields: the server's `required_fields` (LO-B5) for
 * the product it saved, filled or not, so a resumed session shows a filled one
 * the source would hide. While the applicant's product differs from the saved
 * one they wait for the next save. An older API that doesn't send them falls
 * back to the fields remembered from `missing_fields`.
 */
export function productRequiredFields(state: ServerView | null, productId: number | null, memory: RequiredMemory): readonly string[] {
  if (state?.required_fields === undefined) return memory.fields;
  return state.draft.loan.loan_product_id === productId ? state.required_fields : [];
}

/**
 * The fallback for an older API that doesn't send `required_fields`: the
 * server names a required field in `missing_fields` only while it's blank. A
 * field it names outside the saved source's own fields can only be the
 * product's (the source's own rules never ask for it), so it is kept after
 * it's filled, until the product changes, and its field doesn't vanish once
 * typed in. Nothing is remembered once the server sends `required_fields`.
 */
export function rememberRequired(memory: RequiredMemory, state: ServerView): RequiredMemory {
  if (state.required_fields !== undefined) return memory;
  const productId = state.draft.loan.loan_product_id;
  const own = ownFields(state.draft.employment.income_source);
  const fields = productId === memory.productId ? [...memory.fields] : [];
  for (const key of Object.keys(state.missing_fields)) {
    const field = employmentField(key);
    const setting = `employment.${field}`;
    if (field && !own.includes(field) && !fields.includes(setting)) fields.push(setting);
  }
  return productId === memory.productId && fields.length === memory.fields.length ? memory : { productId, fields };
}
