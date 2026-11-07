"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { DataState } from "@/components/common/data-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useApiResource } from "@/hooks/use-api-resource";
import { notifyError, notifySuccess } from "@/lib/notify";
import { portalService } from "@/services/portal.service";
import type { PortalRequest } from "@/types/portal";
import { NewRequestDialog } from "../../_components/new-request-dialog";
import { usePortalConfig } from "../../_components/portal-config";
import { PortalPageHeader } from "../../_components/portal-shell";
import { RequestCard } from "./_components/request-card";
import { ReplyDialog } from "./_components/reply-dialog";

const fetchRequests = () => portalService.requests();

export default function MemberRequestsPage() {
  const { config } = usePortalConfig();
  const resource = useApiResource(fetchRequests);
  const [creating, setCreating] = useState(false);
  const [replyTo, setReplyTo] = useState<PortalRequest | null>(null);
  const [cancelling, setCancelling] = useState<number | null>(null);

  const cancel = (id: number) => {
    setCancelling(id);
    portalService
      .cancelRequest(id)
      .then(() => {
        notifySuccess("Request withdrawn");
        resource.refetch();
      })
      .catch((err) => notifyError(err, "The request could not be withdrawn."))
      .finally(() => setCancelling(null));
  };

  return (
    <>
      <PortalPageHeader
        title="Requests"
        description="Send a request to your cooperative and follow it until it is done."
        actions={
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> New request
          </Button>
        }
      />
      <div className="space-y-5">
        <DataState
          resource={resource}
          endpoints={["GET /portal/requests"]}
          summary="Your requests and the cooperative's replies will show here once online access is connected."
          isEmpty={(rows) => rows.length === 0}
          emptyMessage="You have not sent any requests."
        >
          {(rows) => (
            <Card>
              <CardContent className="py-1">
                <ul className="divide-y">
                  {rows.map((r) => (
                    <RequestCard
                      key={r.id}
                      request={r}
                      cancelling={cancelling === r.id}
                      onCancel={() => cancel(r.id)}
                      onReply={() => setReplyTo(r)}
                    />
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </DataState>
        <p className="text-sm text-muted-foreground">
          {config.features.profile_updates && (
            <>
              To change your contact or personal details, use{" "}
              <Link href="/member/profile" className="underline">
                My profile
              </Link>
              .{" "}
            </>
          )}
          {config.features.loans && config.features.loan_applications && (
            <>
              To borrow, start a{" "}
              <Link href="/member/loans/apply" className="underline">
                loan application
              </Link>
              .
            </>
          )}
        </p>
      </div>
      <NewRequestDialog open={creating} onOpenChange={setCreating} onSubmitted={resource.refetch} />
      <ReplyDialog request={replyTo} onOpenChange={(o) => !o && setReplyTo(null)} onSent={resource.refetch} />
    </>
  );
}
