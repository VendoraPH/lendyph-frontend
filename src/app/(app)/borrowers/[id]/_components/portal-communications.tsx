"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ApiResource } from "@/hooks";
import { formatDateTime } from "@/lib/format";
import type { PortalCommunication } from "@/types/portal-admin";

interface PortalCommunicationsProps {
  open: boolean;
  onToggle: () => void;
  log: ApiResource<PortalCommunication[]>;
}

/**
 * What the portal sent or recorded for the member, newest first: codes issued
 * (never the code), one-time passwords sent (masked number), notices (titles)
 * and downloads, in the server's words. Read only once opened.
 */
export function PortalCommunications({ open, onToggle, log }: PortalCommunicationsProps) {
  const rows = log.data ?? [];
  return (
    <div className="mt-4 border-t pt-3">
      <Button variant="ghost" size="sm" className="-ml-2" aria-expanded={open} onClick={onToggle}>
        {open ? <ChevronDown className="h-4 w-4" aria-hidden /> : <ChevronRight className="h-4 w-4" aria-hidden />}
        Portal activity
      </Button>
      {open && (
        <div className="mt-2 text-sm" aria-live="polite">
          {log.loading && <p className="text-muted-foreground">Loading…</p>}
          {log.error && <p className="text-destructive">{log.error}</p>}
          {!log.loading && !log.error && rows.length === 0 && <p className="text-muted-foreground">Nothing recorded yet.</p>}
          {!log.loading && rows.length > 0 && (
            <ul className="max-h-64 divide-y overflow-y-auto">
              {rows.map((row, i) => (
                <li key={`${row.kind}-${row.date}-${i}`} className="flex flex-wrap gap-x-3 py-1.5">
                  <span className="text-muted-foreground tabular-nums">{row.date ? formatDateTime(row.date) : "—"}</span>
                  <span>{row.description}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
