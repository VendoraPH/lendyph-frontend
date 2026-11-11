"use client";

import { useCallback, useState } from "react";
import { ChevronDown, ChevronUp, ShieldCheck } from "lucide-react";
import { DataState } from "@/components/common/data-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useApiResource, usePermission } from "@/hooks";
import { cdaService } from "@/services";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import { formatDateTime } from "@/lib/format";
import { notifyError } from "@/lib/notify";
import { checkWords, showsFor, snapshotStatus } from "../_lib/screen-gaps";
import { ToneBadge } from "./tone-badge";
import type { CdaSnapshot, CdaSnapshotCheck, CdaSnapshotSummary } from "@/types/cda";

function SnapshotDetails({ snapshot }: { snapshot: CdaSnapshot }) {
  const payload = snapshot.payload;
  if (!payload) return <p className="text-xs text-muted-foreground">This version holds no figures to show.</p>;
  return (
    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs">
      <dt className="text-muted-foreground">Template</dt>
      <dd>{payload.template ? `${payload.template.name}, version ${payload.template.version}` : "—"}</dd>
      <dt className="text-muted-foreground">Readiness</dt>
      <dd>{payload.readiness}%</dd>
      <dt className="text-muted-foreground">Warnings confirmed</dt>
      <dd>{payload.warnings_confirmed ? "Yes" : "No"}</dd>
      <dt className="text-muted-foreground">Issues recorded</dt>
      <dd>{payload.issues.length === 0 ? "None" : payload.issues.length}</dd>
    </dl>
  );
}

function SnapshotRow({ reportId, snapshot }: { reportId: number; snapshot: CdaSnapshotSummary }) {
  const status = snapshotStatus(snapshot);
  const [check, setCheck] = useState<CdaSnapshotCheck | null>(null);
  const [checking, setChecking] = useState(false);
  const [details, setDetails] = useState<CdaSnapshot | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const words = check ? checkWords(check) : null;

  function verify() {
    setChecking(true);
    cdaService
      .verifySnapshot(reportId, snapshot.version)
      .then(setCheck)
      .catch((err: unknown) => notifyError(err, "Could not check the version"))
      .finally(() => setChecking(false));
  }

  function toggleDetails() {
    if (showDetails || details) {
      setShowDetails(!showDetails);
      return;
    }
    setLoadingDetails(true);
    cdaService
      .getSnapshot(reportId, snapshot.version)
      .then((loaded) => {
        setDetails(loaded);
        setShowDetails(true);
      })
      .catch((err: unknown) => notifyError(err, "Could not open the version"))
      .finally(() => setLoadingDetails(false));
  }

  return (
    <li className="space-y-1.5 py-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 font-medium">
          Version {snapshot.version}
          <ToneBadge tone={status.tone} label={status.label} />
        </p>
        <div className="flex gap-1">
          <Button variant="outline" size="xs" onClick={verify} disabled={checking}>
            <ShieldCheck className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
            {checking ? "Checking…" : "Check"}
          </Button>
          <Button variant="ghost" size="xs" onClick={toggleDetails} disabled={loadingDetails} aria-expanded={showDetails}>
            {showDetails ? <ChevronUp className="mr-1 h-3.5 w-3.5" aria-hidden="true" /> : <ChevronDown className="mr-1 h-3.5 w-3.5" aria-hidden="true" />}
            {loadingDetails ? "Opening…" : "Details"}
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Finalized by {snapshot.finalized_by?.name ?? "System"}
        {snapshot.finalized_at && ` · ${formatDateTime(snapshot.finalized_at)}`}
      </p>
      {snapshot.superseded_at && (
        <p className="text-xs text-muted-foreground">
          Reopened by {snapshot.reopened_by?.name ?? "System"} · {formatDateTime(snapshot.superseded_at)}
          {snapshot.reopen_reason && <span className="block italic">“{snapshot.reopen_reason}”</span>}
        </p>
      )}
      <p className="break-all font-mono text-[11px] text-muted-foreground">
        <span className="sr-only">Checksum: </span>
        {snapshot.checksum}
      </p>
      {words && (
        <div role="status" className="space-y-0.5">
          <ToneBadge tone={words.tone} label={words.label} />
          <p className="text-xs text-muted-foreground">{words.detail}</p>
        </div>
      )}
      {showDetails && details && <SnapshotDetails snapshot={details} />}
    </li>
  );
}

/**
 * Every finalized version of the report, newest first, with its SHA-256
 * checksum (CDA design §5). A reopen supersedes a version and keeps it. Check
 * asks the server to hash the stored figures again; it writes nothing.
 */
export function SnapshotHistory({ reportId }: { reportId: number }) {
  const { can } = usePermission();
  const allowed = showsFor("snapshots", can);
  const resource = useApiResource(
    useCallback(() => cdaService.listSnapshots(reportId), [reportId]),
    allowed,
  );
  if (!allowed) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Finalized versions</CardTitle>
        <CardDescription>Each finalize keeps a copy of the figures with its checksum. Check confirms a copy is unchanged.</CardDescription>
      </CardHeader>
      <CardContent>
        <DataState
          resource={resource}
          endpoints={[`GET ${API_ENDPOINTS.CDA.REPORT_SNAPSHOTS(reportId)}`]}
          summary="This report's finalized versions"
          isEmpty={(d) => d.length === 0}
          emptyMessage="No finalized versions yet. Finalizing the report keeps its first one."
        >
          {(items) => (
            <ul className="divide-y">
              {items.map((s) => (
                <SnapshotRow key={s.id} reportId={reportId} snapshot={s} />
              ))}
            </ul>
          )}
        </DataState>
      </CardContent>
    </Card>
  );
}
