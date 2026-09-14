import type { CreateFeeData, FeeConditions, FeeType } from "@/types/fee";

interface FeeFormInput {
  name: string;
  type: FeeType;
  value: string;
  productIds: number[];
  conditions: FeeConditions;
}

export function buildFeePayload(form: FeeFormInput): { payload: CreateFeeData } | { error: string } {
  const value = Number(form.value);
  if (!form.name.trim()) return { error: "Enter a fee name." };
  if (!form.value.trim() || !Number.isFinite(value) || value < 0) {
    return { error: "Enter a fee amount or rate of zero or more." };
  }
  for (const [key, limit] of Object.entries(form.conditions)) {
    if (limit == null) continue;
    if (!Number.isFinite(limit) || limit < 0 || (key.startsWith("term_days") && !Number.isInteger(limit))) {
      return { error: "Conditions must be zero or more; term days must be whole numbers." };
    }
  }
  for (const prefix of ["term_days", "loan_amount"] as const) {
    const gt = form.conditions[`${prefix}_gt`];
    const lt = form.conditions[`${prefix}_lt`];
    const eq = form.conditions[`${prefix}_eq`];
    if ((gt != null && lt != null && gt >= lt) ||
      (eq != null && gt != null && eq <= gt) ||
      (eq != null && lt != null && eq >= lt)) {
      return { error: "The conditions conflict. Check the greater than, less than, and equal to values." };
    }
  }
  const conditions = Object.fromEntries(Object.entries(form.conditions).filter(([, limit]) => limit != null));
  return { payload: {
    name: form.name.trim(), type: form.type, value,
    applicable_product_ids: form.productIds,
    // Omitting this field on PUT preserves the old rules on the API.
    conditions: Object.keys(conditions).length ? conditions : null,
  } };
}
