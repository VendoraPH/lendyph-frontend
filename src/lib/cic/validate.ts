// CSDF validation. Severity follows the CIC classification:
// - M (Mandatory) missing → error (blocks generation);
// - NM (Not Mandatory) missing → nothing, ever;
// - D (Dependent) missing → error only when its condition applies
//   (see validate-rules.ts).
// A value that is present but malformed (bad date, not a number, outside its
// domain, too long) is an error whatever the classification, because it would
// corrupt the position it is written into.
import { CIC_DOMAINS } from "./domains.generated";
import { cicDateKey, cicDateParts, cicNumber, formatCicField, isCicEmpty } from "./format";
import { CIC_LAYOUTS } from "./layouts.generated";
import { applyDependentRules } from "./validate-rules";
import type {
  CicFieldDef,
  CicIssue,
  CicRecordInput,
  CicRecordType,
  CicValidationContext,
} from "./types";

const SUBJECT_TYPES = new Set<CicRecordType>(["ID", "BD"]);
const CONTRACT_TYPES = new Set<CicRecordType>(["CI", "CN", "CC"]);

const domainCodes = new Map<string, Set<string>>(
  Object.entries(CIC_DOMAINS).map(([name, list]) => [
    name,
    new Set((list as readonly { code: string }[]).map((d) => d.code.toUpperCase())),
  ]),
);

export function isInCicDomain(domain: keyof typeof CIC_DOMAINS, value: string): boolean {
  return domainCodes.get(domain)?.has(value.trim().toUpperCase()) ?? false;
}

export function isValidProviderCode(code: string): boolean {
  return /^[A-Za-z0-9]{8}$/.test(code);
}

function checkValue(def: CicFieldDef, raw: unknown): { code: string; message: string } | null {
  const value = raw as Parameters<typeof formatCicField>[1];
  if (def.type === "D" && !cicDateParts(value)) {
    return { code: "INVALID_DATE", message: `${def.name} is not a valid date.` };
  }
  if (def.type === "N") {
    const n = cicNumber(value);
    if (n === null) return { code: "INVALID_NUMBER", message: `${def.name} is not a number.` };
    if (n < 0) return { code: "NEGATIVE_NUMBER", message: `${def.name} cannot be negative.` };
  }
  if (def.domain && !isInCicDomain(def.domain, String(value))) {
    return { code: "NOT_IN_DOMAIN", message: `${def.name} "${String(value).trim()}" is not a CIC code for this field.` };
  }
  const length = formatCicField(def, value).length;
  if (length > def.maxLength) {
    return { code: "TOO_LONG", message: `${def.name} is ${length} characters; CIC allows ${def.maxLength}.` };
  }
  return null;
}

/** Validates one record against its layout and the Dependent conditions. */
export function validateCicRecord(
  record: CicRecordInput,
  ctx: CicValidationContext,
  recordIndex?: number,
): CicIssue[] {
  const { type, values } = record;
  const rules = applyDependentRules(type, values, ctx);
  const fileRef = cicDateKey(ctx.fileReferenceDate);
  const issues: CicIssue[] = [];
  const push = (def: CicFieldDef | undefined, i: Omit<CicIssue, "recordType">) =>
    issues.push({
      recordType: type,
      recordIndex,
      recordLabel: record.label,
      fieldId: def?.id ?? i.fieldId,
      fieldName: def?.name ?? i.fieldName,
      ...i,
    });

  CIC_LAYOUTS[type].forEach((def, position) => {
    // Position 1 is the record code and position 2 the provider code: both are written for the user.
    if (def.fixed !== undefined || position === 1) return;
    const raw = values[def.id];
    if (isCicEmpty(raw)) {
      const why = rules.required.get(def.id);
      if (def.classification === "M") {
        push(def, { severity: "error", code: "MISSING_MANDATORY", message: `${def.name} is mandatory.` });
      } else if (why) {
        push(def, { severity: "error", code: "MISSING_DEPENDENT", message: `${def.name} is required because ${why}.` });
      }
      return;
    }
    const emptyWhy = rules.mustBeEmpty.get(def.id);
    if (emptyWhy) {
      push(def, { severity: "error", code: "MUST_BE_EMPTY", message: `${def.name} must be left empty because ${emptyWhy}.` });
    }
    const bad = checkValue(def, raw);
    if (bad) {
      push(def, { severity: "error", ...bad });
      return;
    }
    if (def.type === "N" && !Number.isInteger(cicNumber(raw))) {
      push(def, { severity: "info", code: "ROUNDED", message: `${def.name} will be reported in whole pesos.` });
    }
    // Position 4 is each record's own reference date.
    if (position === 3 && def.type === "D" && fileRef !== null && (cicDateKey(raw) ?? 0) > fileRef) {
      push(def, { severity: "error", code: "AFTER_FILE_REFERENCE_DATE", message: `${def.name} is later than the File Reference Date.` });
    }
  });

  for (const f of rules.findings) {
    const def = CIC_LAYOUTS[type].find((d) => d.id === f.fieldId);
    push(def, { severity: f.severity, code: f.code, message: f.message, fieldId: f.fieldId });
  }
  return issues;
}

/** Validates a whole submission: the header inputs, every record, and the links between records. */
export function validateCsdf(
  records: readonly CicRecordInput[],
  ctx: CicValidationContext,
): CicIssue[] {
  const issues: CicIssue[] = [];
  if (!isValidProviderCode(ctx.providerCode)) {
    issues.push({
      recordType: "HD", fieldId: "HD2", fieldName: "Provider Code", severity: "error", code: "PROVIDER_CODE",
      message: "The CIC provider code must be exactly 8 letters or digits. Set it in CIC Settings.",
    });
  }
  if (!cicDateParts(ctx.fileReferenceDate)) {
    issues.push({
      recordType: "HD", fieldId: "HD3", fieldName: "File Reference Date", severity: "error", code: "MISSING_MANDATORY",
      message: "Choose the File Reference Date.",
    });
  }
  if (records.length === 0) {
    issues.push({ recordType: "FT", severity: "warning", code: "EMPTY_FILE", message: "The file has no records." });
  }

  const subjects = new Map<string, number>();
  const contracts = new Set<string>();
  records.forEach((record, i) => {
    issues.push(...validateCicRecord(record, ctx, i));
    const subjectNo = String(record.values[`${record.type}5`] ?? "").trim();
    if (SUBJECT_TYPES.has(record.type) && subjectNo) {
      if (subjects.has(subjectNo)) {
        issues.push({
          recordType: record.type, recordIndex: i, recordLabel: record.label, fieldId: `${record.type}5`,
          fieldName: "Provider Subject No", severity: "error", code: "DUPLICATE_SUBJECT",
          message: `Subject number ${subjectNo} is reported more than once.`,
        });
      }
      subjects.set(subjectNo, i);
    }
    if (CONTRACT_TYPES.has(record.type)) {
      const key = [record.type, subjectNo, record.values[`${record.type}6`], record.values[`${record.type}7`]].join("|");
      if (contracts.has(key)) {
        issues.push({
          recordType: record.type, recordIndex: i, recordLabel: record.label, fieldId: `${record.type}7`,
          fieldName: "Provider Contract No", severity: "error", code: "DUPLICATE_CONTRACT",
          message: "This contract is reported more than once for the same subject and role.",
        });
      }
      contracts.add(key);
    }
  });

  records.forEach((record, i) => {
    if (!CONTRACT_TYPES.has(record.type) && record.type !== "NE" && record.type !== "SL") return;
    const subjectNo = String(record.values[`${record.type}5`] ?? "").trim();
    if (subjectNo && !subjects.has(subjectNo)) {
      issues.push({
        recordType: record.type, recordIndex: i, recordLabel: record.label, fieldId: `${record.type}5`,
        fieldName: "Provider Subject No", severity: "warning", code: "SUBJECT_NOT_IN_FILE",
        message: `Subject ${subjectNo} has no ID or BD record in this file.`,
      });
    }
  });
  return issues;
}

export interface CicIssueSummary {
  errors: number;
  warnings: number;
  infos: number;
  /** Generation is blocked while any error remains. */
  blocking: boolean;
}

export function summarizeCicIssues(issues: readonly CicIssue[]): CicIssueSummary {
  const count = (s: CicIssue["severity"]) => issues.filter((i) => i.severity === s).length;
  const errors = count("error");
  return { errors, warnings: count("warning"), infos: count("info"), blocking: errors > 0 };
}
