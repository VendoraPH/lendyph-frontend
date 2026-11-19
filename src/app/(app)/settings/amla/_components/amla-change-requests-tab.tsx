"use client";

import { useCallback, useState } from "react";
import { DataState } from "@/components/common/data-state";
import { ScrollBox } from "@/components/common/page-fill";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Label } from "@/components/ui/label";
import { useApiResource, usePermission } from "@/hooks";
import { amlaApi } from "@/lib/amla/api";
import { AMLA_CHANGE_STATUS_OPTIONS } from "@/lib/amla/settings-view";
import { useAuthStore } from "@/store";
import type { AmlaChangeRequest } from "@/types/amla";
import { AmlaChangeRequestList } from "./amla-change-request-list";
import { AmlaNoteDialog, type AmlaNoteAction } from "./amla-note-dialog";
import { AmlaPager } from "@/components/amla/amla-pager";
import { amlaDecisionAction, type AmlaDecision } from "./amla-decisions";

/** Every settings and calendar change, newest first, with the maker-checker steps the server allows. */
export function AmlaChangeRequestsTab() {
  const [status, setStatus] = useState("pending");
  const [page, setPage] = useState(1);
  const [action, setAction] = useState<AmlaNoteAction | null>(null);
  const { can } = usePermission();
  const userId = useAuthStore((state) => state.user?.id ?? null);

  const fetcher = useCallback(() => amlaApi.changeRequests({ status: status === "" ? null : status, page }), [status, page]);
  const resource = useApiResource(fetcher);

  function decide(request: AmlaChangeRequest, decision: AmlaDecision) {
    setAction(amlaDecisionAction(request, decision));
  }

  return (
    <>
      <div className="flex shrink-0 flex-wrap items-end gap-3 pb-3">
        <div className="space-y-1">
          <Label htmlFor="amla-request-status">Show</Label>
          <NativeSelect
            id="amla-request-status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <NativeSelectOption value="">All requests</NativeSelectOption>
            {AMLA_CHANGE_STATUS_OPTIONS.map((o) => (
              <NativeSelectOption key={o.value} value={o.value}>
                {o.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      </div>
      <DataState
        resource={resource}
        summary="AMLA settings and calendar changes, and their approvals."
        endpoints={["GET /amla/change-requests"]}
        isEmpty={(result) => result.data.length === 0}
        emptyMessage={status === "pending" ? "No change is waiting for approval." : "No change requests yet."}
        emptyIllustration={status === "pending" ? "allCaughtUp" : "empty"}
      >
        {(result) => (
          <>
            <ScrollBox className="min-h-0 flex-1">
              <AmlaChangeRequestList requests={result.data} userId={userId} can={can} onDecide={decide} />
            </ScrollBox>
            <AmlaPager meta={result.meta} onPage={setPage} />
          </>
        )}
      </DataState>
      <AmlaNoteDialog
        action={action}
        onClose={() => setAction(null)}
        onDone={() => {
          setAction(null);
          resource.refetch();
        }}
      />
    </>
  );
}
