"use client";

import { useCallback, useState } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadState } from "@/components/portal/load-state";
import { PortalPageHeader } from "@/components/portal/page-header";
import { SectionCard } from "@/components/portal/section-card";
import { usePortalResource } from "@/lib/portal/hooks/use-portal-resource";
import { NONE } from "@/lib/portal/labels";
import { portalService } from "@/lib/portal/portal-api";
import { NewRequestDialog } from "../requests/_components/new-request-dialog";

/**
 * The member's own profile, masked by the server (portal design §1): mobile
 * and email partly hidden, the birth year only, the street line "On file",
 * IDs by type and last 4. A change goes through a request staff review.
 */
export default function ProfilePage() {
  const fetcher = useCallback(() => portalService.profile(), []);
  const { data, loading, error, reload } = usePortalResource(fetcher, "We couldn't load your profile. Please try again.");
  const [open, setOpen] = useState(false);
  const canRequest = (data?.editable_fields.length ?? 0) > 0;

  return (
    <>
      <PortalPageHeader
        title="Profile"
        description="Some details are partly hidden to keep them safe."
        actions={canRequest ? <Button onClick={() => setOpen(true)}>Request a change</Button> : undefined}
      />
      <LoadState loading={loading} error={error} onRetry={reload}>
        {data && (
          <SectionCard title="Your details">
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {data.fields.map((field, index) => (
                <div key={`${field.key}-${index}`} className="border-b border-dashed pb-2">
                  <dt className="text-xs text-muted-foreground">{field.label}</dt>
                  <dd className="flex items-center gap-1.5 text-sm break-words">
                    {field.value ?? NONE}
                    {field.masked && field.value && (
                      <Lock className="h-3 w-3 text-muted-foreground" aria-label="Partly hidden for your security" />
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </SectionCard>
        )}
      </LoadState>
      {canRequest && <NewRequestDialog open={open} onOpenChange={setOpen} initialType="profile_update" />}
    </>
  );
}
