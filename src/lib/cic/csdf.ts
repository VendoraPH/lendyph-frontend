// Builds a CSDF (Credit Submission Data File): one header line, the records,
// one footer line. The backend is the one that writes the file that is
// encrypted and sent; this mirrors it so the wizard can preview exactly what
// will be generated, and so the layout rules are tested in one place.
import { formatCicRecord } from "./format";
import type { CicRecordInput, CicSubmissionType } from "./types";

export interface CsdfHeaderInput {
  providerCode: string;
  /** `YYYY-MM-DD`: the date the data is as of (usually a month end), not the day the file is made. */
  fileReferenceDate: string;
  submissionType: CicSubmissionType;
  comments?: string;
}

export function buildCsdfHeader(input: CsdfHeaderInput): string {
  return formatCicRecord(
    "HD",
    {
      HD3: input.fileReferenceDate,
      HD5: String(input.submissionType),
      HD6: input.comments,
    },
    input.providerCode,
  );
}

/** FT4 counts the records between the header and the footer. */
export function buildCsdfFooter(
  providerCode: string,
  fileReferenceDate: string,
  recordCount: number,
): string {
  return formatCicRecord("FT", { FT3: fileReferenceDate, FT4: recordCount }, providerCode);
}

const manilaStamp = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Manila",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

/** `YYYYMMDDhh24mmss` of an instant, in Manila time. */
export function csdfTimestamp(at: Date): string {
  const parts = Object.fromEntries(manilaStamp.formatToParts(at).map((p) => [p.type, p.value]));
  return `${parts.year}${parts.month}${parts.day}${parts.hour}${parts.minute}${parts.second}`;
}

/** `[ProviderCode]_CSDF_[YYYYMMDDhh24mmss].txt`, stamped with the time the file is created. */
export function buildCsdfFilename(providerCode: string, createdAt: Date): string {
  return `${providerCode}_CSDF_${csdfTimestamp(createdAt)}.txt`;
}

export interface CsdfFile {
  filename: string;
  content: string;
  recordCount: number;
}

export interface BuildCsdfInput extends CsdfHeaderInput {
  records: readonly CicRecordInput[];
  createdAt: Date;
  /** CIC's 2016 guide does not name a line ending; CRLF until CIC says otherwise. */
  lineEnding?: "\r\n" | "\n";
}

export function buildCsdfFile(input: BuildCsdfInput): CsdfFile {
  const eol = input.lineEnding ?? "\r\n";
  const lines = [
    buildCsdfHeader(input),
    ...input.records.map((r) => formatCicRecord(r.type, r.values, input.providerCode)),
    buildCsdfFooter(input.providerCode, input.fileReferenceDate, input.records.length),
  ];
  return {
    filename: buildCsdfFilename(input.providerCode, input.createdAt),
    // No BOM: the file must start with "HD".
    content: lines.join(eol).replace(/^﻿/, "") + eol,
    recordCount: input.records.length,
  };
}

/** UTF-8 bytes without a byte-order mark (TextEncoder never writes one). */
export function csdfBytes(file: CsdfFile): Uint8Array {
  return new TextEncoder().encode(file.content);
}
