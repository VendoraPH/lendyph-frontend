"use client";

import { useCallback, useState } from "react";
import { MonitorSmartphone } from "lucide-react";
import { DataState } from "@/components/common/data-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePermission } from "@/hooks";
import { useSubmitGuard } from "@/hooks/use-submit-guard";
import { formatDate, formatDateTime } from "@/lib/format";
import { notifySuccess } from "@/lib/notify";
import { portalAdminService } from "@/services/portal-admin.service";
import type { PortalAccessCard as AccessCardData, PortalCodeKind, PortalStaffDisableReason } from "@/types/portal-admin";
import { ActionButton } from "@/app/(app)/savings/_components/action-button";
import { StateBadge } from "@/app/(app)/member-portal/_components/state-badge";
import { usePortalResource } from "@/app/(app)/member-portal/_hooks/use-portal-resource";
import { accessOffer, inviteBlocked } from "@/app/(app)/member-portal/_lib/access-rules";
import {
  ACCESS_STATE_LABELS,
  ACCESS_STATE_TONES,
  CODE_KIND_LABELS,
  CODE_STATUS_LABELS,
  DISABLE_REASON_LABELS,
  labelOf,
  toneOf,
} from "@/app/(app)/member-portal/_lib/labels";
import { notifyPortalError } from "@/app/(app)/member-portal/_lib/notify-portal-error";
import { DisablePortalDialog } from "./disable-portal-dialog";
import { PortalCodeDialog } from "./portal-code-dialog";
import { PortalCommunications } from "./portal-communications";

/**
 * A member's Member Portal access and the staff actions on it: issue an
 * activation or reset code, unlock, sign out everywhere, and turn access off
 * (with a reason) or back on. Shown when the portal is switched on and the
 * user holds member_portal:view. Adapted from #511 by Augustin.
 */
export function PortalAccessCard({ borrowerId, memberName }: { borrowerId: number; memberName: string }) {
  const fetchAccess = useCallback(() => portalAdminService.access(borrowerId), [borrowerId]);
  const access = usePortalResource(fetchAccess);
  const [codeKind, setCodeKind] = useState<PortalCodeKind | null>(null);
  const [disabling, setDisabling] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const fetchLog = useCallback(() => portalAdminService.communications(borrowerId), [borrowerId]);
  const log = usePortalResource(fetchLog, logOpen);
  const { submitting, run } = useSubmitGuard();

  const changed = () => {
    access.refetch();
    log.refetch();
  };

  const act = (call: () => Promise<unknown>, done: (result: unknown) => string, after?: () => void) =>
    run(call)
      ?.then((result) => {
        notifySuccess(done(result));
        after?.();
        changed();
      })
      .catch((err: unknown) => notifyPortalError(err, "The member's portal access couldn't be changed."));

  return (
    <Card className="md:col-span-2">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <MonitorSmartphone className="h-4 w-4 text-muted-foreground" aria-hidden />
          Member Portal
        </CardTitle>
      </CardHeader>
      <CardContent>
        <DataState resource={access} endpoints={[]} summary="This member's Member Portal access.">
          {(card) => (
            <AccessBody
              card={card}
              busy={submitting}
              onCode={setCodeKind}
              onUnlock={() =>
                act(
                  () => portalAdminService.unlock(borrowerId),
                  (r) => ((r as AccessCardData).unlocked === false ? "This portal account wasn't locked" : "Portal account unlocked"),
                )
              }
              onSignOut={() =>
                act(
                  () => portalAdminService.signOut(borrowerId),
                  (r) => {
                    const n = (r as { sessions_ended?: number }).sessions_ended ?? 0;
                    return n === 1 ? "Signed out of 1 device" : `Signed out of ${n} devices`;
                  },
                )
              }
              onDisable={() => setDisabling(true)}
              onEnable={() => act(() => portalAdminService.enable(borrowerId), () => "Portal access turned back on")}
            />
          )}
        </DataState>
        {access.data && access.data.state !== "not_invited" && (
          <PortalCommunications open={logOpen} onToggle={() => setLogOpen((o) => !o)} log={log} />
        )}
      </CardContent>
      <PortalCodeDialog
        kind={codeKind}
        borrowerId={borrowerId}
        memberName={memberName}
        onOpenChange={(open) => !open && setCodeKind(null)}
        onIssued={changed}
      />
      <DisablePortalDialog
        open={disabling}
        onOpenChange={setDisabling}
        busy={submitting}
        onConfirm={(reason: PortalStaffDisableReason) =>
          act(
            () => portalAdminService.disable(borrowerId, reason),
            () => "Portal access turned off",
            () => setDisabling(false),
          )
        }
      />
    </Card>
  );
}

interface AccessBodyProps {
  card: AccessCardData;
  busy: boolean;
  onCode: (kind: PortalCodeKind) => void;
  onUnlock: () => void;
  onSignOut: () => void;
  onDisable: () => void;
  onEnable: () => void;
}

function AccessBody({ card, busy, onCode, onUnlock, onSignOut, onDisable, onEnable }: AccessBodyProps) {
  const { can } = usePermission();
  const offer = accessOffer(card);
  const blocked = inviteBlocked(card);
  const anyAction = can("member_portal:invite") || can("member_portal:manage");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <StateBadge label={labelOf(ACCESS_STATE_LABELS, card.state)} tone={toneOf(ACCESS_STATE_TONES, card.state)} />
        {card.state === "disabled" && card.disabled_reason && (
          <span className="text-xs text-muted-foreground">{labelOf(DISABLE_REASON_LABELS, card.disabled_reason)}</span>
        )}
        {card.locked_until && (
          <span className="text-xs text-muted-foreground">Locked until {formatDateTime(card.locked_until)}</span>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3 lg:grid-cols-6">
        <Fact label="Invited" value={card.invited_at && formatDate(card.invited_at)} />
        <Fact label="Activated" value={card.activated_at && formatDate(card.activated_at)} />
        <Fact label="Last sign-in" value={card.last_login_at && formatDateTime(card.last_login_at)} />
        <Fact label="Password changed" value={card.password_changed_at && formatDate(card.password_changed_at)} />
        <Fact label="Terms accepted" value={card.terms_version && `Version ${card.terms_version}`} />
        <Fact
          label={card.code ? labelOf(CODE_KIND_LABELS, card.code.kind) : "Latest code"}
          value={
            card.code &&
            `${labelOf(CODE_STATUS_LABELS, card.code.status)}${card.code.status === "open" ? `, until ${formatDateTime(card.code.expires_at)}` : ""}`
          }
        />
      </dl>

      {anyAction && (
        <div className="flex flex-wrap gap-2">
          {offer.invite && (
            <ActionButton
              permission="member_portal:invite"
              size="sm"
              disabled={busy}
              blockedReason={blocked}
              onClick={() => onCode("activation")}
            >
              {offer.invite === "invite" ? "Invite" : "Issue new code"}
            </ActionButton>
          )}
          {offer.resetCode && (
            <ActionButton permission="member_portal:invite" size="sm" disabled={busy} onClick={() => onCode("reset")}>
              Password reset code
            </ActionButton>
          )}
          {offer.unlock && (
            <ActionButton permission="member_portal:manage" size="sm" variant="outline" disabled={busy} onClick={onUnlock}>
              Unlock
            </ActionButton>
          )}
          {offer.signOut && (
            <ActionButton permission="member_portal:manage" size="sm" variant="outline" disabled={busy} onClick={onSignOut}>
              Sign out everywhere
            </ActionButton>
          )}
          {offer.disable && (
            <ActionButton
              permission="member_portal:manage"
              size="sm"
              variant="outline"
              className="text-destructive"
              disabled={busy}
              onClick={onDisable}
            >
              Turn off access
            </ActionButton>
          )}
          {card.state === "disabled" && (
            <ActionButton
              permission="member_portal:manage"
              size="sm"
              variant="outline"
              disabled={busy}
              blockedReason={offer.enableBlocked}
              onClick={onEnable}
            >
              Turn access back on
            </ActionButton>
          )}
        </div>
      )}
    </div>
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
