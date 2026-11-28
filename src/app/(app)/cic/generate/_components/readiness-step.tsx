import { formatDateTime } from "@/lib/format";
import type { CicReadiness, CicSettings } from "@/types/cic";

const KEY_STATUS: Record<NonNullable<CicSettings["public_key"]>["status"], string> = {
  valid: "Verified",
  unverified: "Not verified",
  expired: "Expired",
};

/** Step 2: who reports, with which key, and how many records the server will put in the file. */
export function ReadinessStep({ settings, readiness }: { settings: CicSettings; readiness: CicReadiness }) {
  const key = settings.public_key;
  return (
    <dl className="grid max-w-xl grid-cols-[12rem_1fr] gap-x-4 gap-y-1.5 text-sm">
      <dt className="text-muted-foreground">Provider code</dt>
      <dd className="font-mono">{settings.provider_code ?? "Not set"}</dd>
      <dt className="text-muted-foreground">Reporting as</dt>
      <dd>{settings.is_mfi ? "Microfinance institution" : "Lender (not MFI)"}</dd>
      <dt className="text-muted-foreground">CIC public key</dt>
      <dd className="break-all font-mono text-xs">{key?.fingerprint ?? "Not uploaded"}</dd>
      {key && (
        <>
          <dt className="text-muted-foreground">Key status</dt>
          <dd>
            {KEY_STATUS[key.status]}
            {key.expires_at && <span className="text-muted-foreground"> · expires {formatDateTime(key.expires_at)}</span>}
          </dd>
        </>
      )}
      <dt className="text-muted-foreground">Subjects</dt>
      <dd>
        {readiness.subjects.total} ({readiness.subjects.with_errors} with errors)
      </dd>
      <dt className="text-muted-foreground">Contracts</dt>
      <dd>
        {readiness.contracts.total} ({readiness.contracts.with_errors} with errors)
      </dd>
      {readiness.unmapped_products > 0 && (
        <>
          <dt className="text-muted-foreground">Unmapped products</dt>
          <dd>{readiness.unmapped_products}: their loans are left out until mapped in CIC Settings.</dd>
        </>
      )}
    </dl>
  );
}
