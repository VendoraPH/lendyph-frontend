"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { useApiResource } from "@/hooks/use-api-resource";
import { formatDateTime } from "@/lib/format";
import { humanize, PROFILE_FIELDS, REQUEST_STATUS, TONE_CLASS } from "@/lib/portal/labels";
import { portalAdminService } from "@/services/portal-admin.service";
import type { ProfileRequestDecision, ProfileRequestStatus, StaffProfileRequest } from "@/types/portal";
import { DecisionDialog, type DecisionOption } from "./decision-dialog";

type ProfileDecision = ProfileRequestDecision["decision"];

const OPTIONS: DecisionOption<ProfileDecision>[] = [
  { value: "approve", label: "Approve and update the member record" },
  { value: "need_info", label: "Ask for information" },
  { value: "reject", label: "Reject" },
];

const OPEN: ProfileRequestStatus[] = ["submitted", "under_review", "need_info"];

/** Members' requested profile changes: current value → requested value, then decide. */
export function ProfileRequestsQueue() {
  const [status, setStatus] = useState<ProfileRequestStatus | "">("submitted");
  const [deciding, setDeciding] = useState<StaffProfileRequest | null>(null);
  const fetcher = useCallback(() => portalAdminService.profileRequests(status || undefined), [status]);
  const resource = useApiResource(fetcher);
  const rows = resource.data ?? [];

  return (
    <div className="space-y-3">
      <NativeSelect
        aria-label="Filter by status"
        value={status}
        onChange={(e) => setStatus(e.target.value as ProfileRequestStatus | "")}
      >
        <NativeSelectOption value="">All statuses</NativeSelectOption>
        {(Object.keys(REQUEST_STATUS) as ProfileRequestStatus[]).map((s) => (
          <NativeSelectOption key={s} value={s}>
            {REQUEST_STATUS[s].label}
          </NativeSelectOption>
        ))}
      </NativeSelect>

      {resource.unavailable && (
        <p className="text-sm text-muted-foreground">
          Profile change requests are not connected yet (GET /portal-admin/profile-requests).
        </p>
      )}
      {resource.error && <p className="text-sm text-destructive">{resource.error}</p>}
      {!resource.loading && !resource.unavailable && rows.length === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">No profile change requests here.</p>
      )}

      {rows.map((r) => {
        const st = REQUEST_STATUS[r.status] ?? { label: humanize(r.status), tone: "muted" as const };
        return (
          <Card key={r.id}>
            <CardContent className="space-y-3 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <Link href={`/borrowers/${r.borrower_id}`} className="font-medium hover:underline">
                    {r.member_name}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {r.member_number} · {r.reference} · {formatDateTime(r.submitted_at)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TONE_CLASS[st.tone]}`}>
                    {st.label}
                  </span>
                  {OPEN.includes(r.status) && (
                    <Button size="sm" variant="outline" onClick={() => setDeciding(r)}>
                      Review
                    </Button>
                  )}
                </div>
              </div>
              <div className="grid gap-1 text-sm sm:grid-cols-[10rem_1fr_1fr]">
                {r.changes.map((c) => (
                  <div key={c.field} className="contents">
                    <span className="text-muted-foreground">{PROFILE_FIELDS[c.field] ?? humanize(c.field)}</span>
                    <span className="break-words text-muted-foreground line-through">{c.current || "—"}</span>
                    <span className="break-words font-medium">{c.requested}</span>
                  </div>
                ))}
              </div>
              {r.remarks && <p className="text-sm text-muted-foreground">Member&apos;s note: {r.remarks}</p>}
              {r.response && <p className="text-sm">Reply sent: {r.response}</p>}
            </CardContent>
          </Card>
        );
      })}

      <DecisionDialog
        subject={deciding}
        options={OPTIONS}
        needsResponse={(d) => d !== "approve"}
        submit={(id, decision, response) =>
          portalAdminService.decideProfileRequest(id, { decision, response: response || undefined })
        }
        onOpenChange={(open) => !open && setDeciding(null)}
        onDone={resource.refetch}
      />
    </div>
  );
}
