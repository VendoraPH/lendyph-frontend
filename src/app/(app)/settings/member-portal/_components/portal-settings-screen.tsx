"use client";

import { useCallback } from "react";
import { DataState } from "@/components/common/data-state";
import { usePermission } from "@/hooks";
import { portalAdminService } from "@/services/portal-admin.service";
import { usePortalResource } from "@/app/(app)/member-portal/_hooks/use-portal-resource";
import { PortalSettingsForm } from "./portal-settings-form";
import { TermsCard } from "./terms-card";

/**
 * Settings → Member Portal. The settings apply to every branch, so reading
 * and changing them needs member_portal:settings and branches:view_all, as
 * the server checks. Adapted from #511 by Augustin.
 */
export function PortalSettingsScreen() {
  const { can } = usePermission();
  const viewAll = can("branches:view_all");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Member Portal</h1>
        <p className="text-sm text-muted-foreground">
          How members sign in and what they can see and ask for online. Members sign in with their member number and a
          code issued at the branch; there is no self-registration.
        </p>
      </div>
      {viewAll ? (
        <SettingsBody />
      ) : (
        <p className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
          Member Portal settings apply to every branch, so they need the Branch Access: See all branches permission as
          well.
        </p>
      )}
    </div>
  );
}

function SettingsBody() {
  const fetcher = useCallback(() => portalAdminService.settings(), []);
  const resource = usePortalResource(fetcher);
  return (
    <DataState resource={resource} endpoints={[]} summary="The Member Portal settings.">
      {(settings) => (
        <div className="space-y-6">
          <PortalSettingsForm key={settings.updated_at ?? "new"} settings={settings} onSaved={resource.refetch} />
          <TermsCard current={settings.terms} onPublished={resource.refetch} />
        </div>
      )}
    </DataState>
  );
}
