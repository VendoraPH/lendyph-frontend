"use client";

import { useCallback, useState } from "react";
import { Globe } from "lucide-react";
import { PermissionButton } from "@/components/common/permission-button";
import { DataState } from "@/components/common/data-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useApiResource } from "@/hooks/use-api-resource";
import { formatDate, formatDateTime } from "@/lib/format";
import { notifyError, notifySuccess } from "@/lib/notify";
import { ACCOUNT_STATUS, accountActions, DISABLE_REASONS, TONE_CLASS } from "@/lib/portal/labels";
import { portalAdminService } from "@/services/portal-admin.service";
import type { PortalAccess } from "@/types/portal";
import { DisablePortalDialog } from "./disable-portal-dialog";

/**
 * A member's online-access status and the staff actions on it. Rendered only
 * when the portal flag is on and the user holds member_portal:view.
 */
export function PortalAccessCard({ borrowerId }: { borrowerId: number }) {
  const fetchAccess = useCallback(() => portalAdminService.access(borrowerId), [borrowerId]);
  const access = useApiResource(fetchAccess);
  const fetchLog = useCallback(() => portalAdminService.communications(borrowerId), [borrowerId]);
  const log = useApiResource(fetchLog, !access.unavailable);
  const [busy, setBusy] = useState(false);
  const [disabling, setDisabling] = useState(false);

  const run = (call: Promise<PortalAccess>, done: string) => {
    setBusy(true);
    call
      .then(() => {
        notifySuccess(done);
        access.refetch();
        log.refetch();
      })
      .catch((err) => notifyError(err, "The member's online access could not be updated."))
      .finally(() => setBusy(false));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Globe className="h-4 w-4" aria-hidden /> Member Portal Access
        </CardTitle>
      </CardHeader>
      <CardContent>
        <DataState
          resource={access}
          endpoints={["GET /portal-admin/members/{id}/access"]}
          summary="Whether this member can sign in online, and the invitations sent to them."
        >
          {(a) => {
            const status = ACCOUNT_STATUS[a.status] ?? { label: a.status, tone: "muted" as const };
            const can = accountActions(a.status);
            return (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${TONE_CLASS[status.tone]}`}>
                    {status.label}
                  </span>
                  {a.disabled_reason && (
                    <span className="text-xs text-muted-foreground">{DISABLE_REASONS[a.disabled_reason]}</span>
                  )}
                </div>
                <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                  <Fact label="Invited" value={a.invited_at && formatDate(a.invited_at)} />
                  <Fact label="Registered" value={a.registered_at && formatDate(a.registered_at)} />
                  <Fact label="Last sign-in" value={a.last_login_at && formatDateTime(a.last_login_at)} />
                  <Fact
                    label="Terms accepted"
                    value={a.terms_version_accepted && `v${a.terms_version_accepted}`}
                  />
                </dl>
                <div className="flex flex-wrap gap-2">
                  {(can.invite || can.resend) && (
                    <PermissionButton
                      permission="member_portal:manage"
                      size="sm"
                      disabled={busy}
                      onClick={() =>
                        run(portalAdminService.invite(borrowerId), can.resend ? "Invitation re-sent" : "Invitation sent")
                      }
                    >
                      {can.resend ? "Resend invitation" : "Send invitation"}
                    </PermissionButton>
                  )}
                  {can.unlock && (
                    <PermissionButton
                      permission="member_portal:manage"
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => run(portalAdminService.unlock(borrowerId), "Account unlocked")}
                    >
                      Unlock
                    </PermissionButton>
                  )}
                  {can.enable && (
                    <PermissionButton
                      permission="member_portal:manage"
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() =>
                        run(portalAdminService.updateAccess(borrowerId, { enabled: true }), "Online access enabled")
                      }
                    >
                      Enable access
                    </PermissionButton>
                  )}
                  {can.disable && (
                    <PermissionButton
                      permission="member_portal:manage"
                      size="sm"
                      variant="outline"
                      className="text-destructive"
                      disabled={busy}
                      onClick={() => setDisabling(true)}
                    >
                      Disable access
                    </PermissionButton>
                  )}
                </div>
                <DisablePortalDialog
                  open={disabling}
                  onOpenChange={setDisabling}
                  busy={busy}
                  onConfirm={(reason) => {
                    setDisabling(false);
                    run(
                      portalAdminService.updateAccess(borrowerId, { enabled: false, disabled_reason: reason }),
                      "Online access disabled",
                    );
                  }}
                />
                {(log.data?.length ?? 0) > 0 && (
                  <div>
                    <p className="mb-1.5 text-xs font-medium text-muted-foreground">Communications</p>
                    <ul className="divide-y text-sm">
                      {log.data!.map((c) => (
                        <li key={c.id} className="flex flex-wrap gap-x-3 py-1.5">
                          <span className="text-muted-foreground">{formatDateTime(c.at)}</span>
                          <span className="uppercase text-xs text-muted-foreground">{c.channel.replace("_", "-")}</span>
                          <span>{c.description}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          }}
        </DataState>
      </CardContent>
    </Card>
  );
}

function Fact({ label, value }: { label: string; value: string | null | false }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value || "—"}</dd>
    </div>
  );
}
