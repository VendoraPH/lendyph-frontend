"use client";

import { useState } from "react";
import { ChevronDown, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";
import { TONE_CLASS, humanize } from "@/lib/portal/labels";
import { PORTAL_REQUEST_STATUS, REQUEST_TYPES, canCancel } from "@/lib/portal/requests";
import type { PortalRequest } from "@/types/portal";
import { StatusPill } from "../../../_components/portal-shell";
import { RequestTimeline } from "../../../_components/request-timeline";

interface RequestCardProps {
  request: PortalRequest;
  cancelling: boolean;
  onCancel: () => void;
  onReply: () => void;
}

/** One request: what was asked, where it stands, and the cooperative's reply. */
export function RequestCard({ request: r, cancelling, onCancel, onReply }: RequestCardProps) {
  const [expanded, setExpanded] = useState(false);
  const status = PORTAL_REQUEST_STATUS[r.status] ?? { label: humanize(r.status), tone: "muted" as const };
  const def = REQUEST_TYPES[r.type];
  const labelFor = (key: string) => def?.fields.find((f) => f.key === key)?.label ?? humanize(key);

  return (
    <li className="space-y-2 py-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{def?.label ?? humanize(r.type)}</span>
        <StatusPill className={TONE_CLASS[status.tone]}>{status.label}</StatusPill>
        <span className="text-xs text-muted-foreground">
          {r.reference} · {formatDateTime(r.submitted_at)}
        </span>
      </div>
      {r.summary && <p className="text-muted-foreground">{r.summary}</p>}
      {r.response && (
        <p className="rounded-md bg-muted p-2 text-xs">Cooperative&apos;s reply: {r.response}</p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>
          <ChevronDown className={`mr-1 h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
          {expanded ? "Hide details" : "Details"}
        </Button>
        {r.status === "need_info" && (
          <Button size="sm" className="h-7" onClick={onReply}>
            Reply
          </Button>
        )}
        {canCancel(r.status) && (
          <Button size="sm" variant="ghost" className="h-7" disabled={cancelling} onClick={onCancel}>
            Withdraw
          </Button>
        )}
      </div>
      {expanded && (
        <div className="grid gap-4 rounded-lg border p-3 sm:grid-cols-2">
          <dl className="space-y-1.5">
            {Object.entries(r.details).map(([key, value]) => (
              <div key={key}>
                <dt className="text-xs text-muted-foreground">{labelFor(key)}</dt>
                <dd>{value ?? "—"}</dd>
              </div>
            ))}
            {r.remarks && (
              <div>
                <dt className="text-xs text-muted-foreground">Your note</dt>
                <dd>{r.remarks}</dd>
              </div>
            )}
            {r.attachments.length > 0 && (
              <div>
                <dt className="text-xs text-muted-foreground">Attachments</dt>
                {r.attachments.map((a) => (
                  <dd key={a.id}>
                    <a href={a.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline">
                      <Paperclip className="h-3 w-3" aria-hidden /> {a.name}
                    </a>
                  </dd>
                ))}
              </div>
            )}
          </dl>
          <RequestTimeline entries={r.timeline} labels={PORTAL_REQUEST_STATUS} />
        </div>
      )}
    </li>
  );
}
