import type { CicDomainName } from "./domains.generated";

/**
 * CSDF record types, in the order a file lists them: header, subjects
 * (individual, business, subject link), contracts (installment,
 * non-installment, credit card), negative events, footer.
 */
export type CicRecordType = "HD" | "ID" | "BD" | "SL" | "CI" | "CN" | "CC" | "NE" | "FT";

/** X = text, N = integer number, D = date (DDMMYYYY). */
export type CicFieldType = "X" | "N" | "D";

/**
 * M = Mandatory (always required), NM = Not Mandatory (never blocks),
 * D = Dependent (required only when its condition applies).
 */
export type CicClassification = "M" | "NM" | "D";

export interface CicFieldDef {
  /** Record code + position, e.g. `ID7` is the 7th field of an ID record. */
  id: string;
  name: string;
  type: CicFieldType;
  classification: CicClassification;
  maxLength: number;
  domain?: CicDomainName;
  /** A value the record always carries (the record code, or HD4 "1.0"). */
  fixed?: string;
  /** The workbook's own condition text for a Dependent field. */
  rule?: string;
}

/** A raw value before formatting: dates as `YYYY-MM-DD` (or a `Date`), amounts as numbers. */
export type CicRawValue = string | number | Date | null | undefined;

/** One record's values keyed by field id (`ID7`). Positions left out are written empty. */
export type CicRecordValues = Partial<Record<string, CicRawValue>>;

export interface CicRecordInput {
  type: CicRecordType;
  values: CicRecordValues;
  /** What a reviewer recognises the record by (member or loan number), shown with its issues. */
  label?: string;
}

export type CicSeverity = "error" | "warning" | "info";

export interface CicIssue {
  severity: CicSeverity;
  code: string;
  message: string;
  recordType: CicRecordType;
  /** Index of the record in the list validated, when there is one. */
  recordIndex?: number;
  recordLabel?: string;
  fieldId?: string;
  fieldName?: string;
}

/** 0 = Standard periodic submission, 1 = Correction / history submission (HD5). */
export type CicSubmissionType = 0 | 1;

export interface CicValidationContext {
  /** Microfinance institutions follow different address rules (StreetNo vs Subdivision). */
  mfi: boolean;
  /** 8-character CIC provider code; fills position 2 of every record. */
  providerCode: string;
  /** The file's reference date, `YYYY-MM-DD`; no record date may be later. */
  fileReferenceDate?: string;
}
