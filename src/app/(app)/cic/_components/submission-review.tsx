import type { ReactNode } from "react";
import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatDateTime } from "@/lib/format";
import { formatCount } from "@/lib/report-format";
import type { CicDataRecordType, CicSubmissionDetail } from "@/types/cic";
import { captureLabel, recordTypeLabel } from "../_lib/labels";
import { ValidationSummary } from "./validation-summary";

const TYPES: CicDataRecordType[] = ["ID", "CI", "CN", "NE"];

function Facts({ rows }: { rows: Row[] }) {
  return (
    <dl className="grid max-w-3xl grid-cols-[11rem_1fr] gap-x-4 gap-y-1.5 text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="min-w-0 break-all">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

const mono = (v: string | null | undefined) => <span className="font-mono text-xs">{v || "—"}</span>;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
}

type Row = [string, ReactNode];

function fileRows(d: CicSubmissionDetail): Row[] {
  const rows: Row[] = [
    ["Reference", d.reference],
    ["Type", `${d.submission_type} · ${d.submission_type_label}`],
    ["Reference date", formatDate(d.reference_date)],
    ["Provider code", mono(d.provider_code)],
    ["Format", `CSDF version ${d.format_version}`],
    ["Text file", mono(d.filename)],
    ["Zip", mono(d.zip_filename)],
    ["Records", TYPES.map((t) => `${t} ${formatCount(d.counts_by_type[t] ?? 0)}`).join(" · ")],
    ["Text SHA-256", mono(d.txt_sha256)],
  ];
  if (d.zip_sha256) rows.push(["Zip SHA-256", mono(d.zip_sha256)]);
  if (d.gpg_sha256) rows.push(["Encrypted SHA-256", mono(d.gpg_sha256)]);
  rows.push(["Comments", d.comments || "—"]);
  rows.push([
    "Capture",
    `${captureLabel(d.capture)}${d.capture.finished_at ? `, ${formatDateTime(d.capture.finished_at)}` : ""}`,
  ]);
  return rows;
}

function encryptionRows(d: CicSubmissionDetail): Row[] {
  const rows: Row[] = [
    ["Method", d.encryption.method],
    ["Archive", d.encryption.archive],
    ["Output", mono(d.encryption.output_extension)],
    ["Recipient", d.encryption.recipient],
  ];
  if (d.encrypted_with) {
    rows.push(["Encrypted for", mono(d.encrypted_with.fingerprint)]);
    return rows;
  }
  const key = d.active_key;
  rows.push(["CIC's active key", key ? mono(key.fingerprint) : "None"]);
  if (key) {
    rows.push(["Issued to", key.user_ids.join(", ") || "—"]);
    rows.push(["Expires", key.expires_at ? formatDate(key.expires_at) : "Never"]);
    rows.push(["Can encrypt", key.usable ? "Yes" : (key.unusable_reason ?? "No")]);
  }
  rows.push(["Encryption on the server", d.encryption.gpg_available ? "Available" : "Not installed on the server"]);
  return rows;
}

/**
 * The pre-encryption review (prompt §12), as the server sends it: the file,
 * its capture, counts and checksums, the live validation, the key it will be
 * encrypted for, and a correction's affected records. No member data.
 */
export function SubmissionReview({ detail }: { detail: CicSubmissionDetail }) {
  return (
    <div className="space-y-6">
      <Section title="File">
        <Facts rows={fileRows(detail)} />
      </Section>

      <Section title="Validation now">
        <ValidationSummary validation={detail.validation} />
      </Section>

      <Section title="Encryption">
        <Facts rows={encryptionRows(detail)} />
      </Section>

      {detail.correction && (
        <Section title="Correction">
          <Facts
            rows={[
              ["Reason", detail.correction.reason || "—"],
              [
                "Corrects",
                detail.correction.corrects ? (
                  <Link href={`/cic/submissions/${detail.correction.corrects.id}`} className="underline">
                    {detail.correction.corrects.reference} · {detail.correction.corrects.status_label}
                  </Link>
                ) : (
                  "—"
                ),
              ],
              ["Affected records", formatCount(detail.correction.affected_count)],
            ]}
          />
          {detail.correction.affected_records.length > 0 && (
            <div className="max-w-3xl rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Record</TableHead>
                    <TableHead>Number</TableHead>
                    <TableHead>Change</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detail.correction.affected_records.map((r) => (
                    <TableRow key={`${r.record_type}-${r.record_key}`}>
                      <TableCell>{recordTypeLabel(r.record_type)}</TableCell>
                      <TableCell className="font-mono text-xs">{r.record_key}</TableCell>
                      <TableCell>{r.change === "added" ? "Added" : "Changed"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Section>
      )}
    </div>
  );
}
