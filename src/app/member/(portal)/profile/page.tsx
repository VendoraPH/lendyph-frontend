"use client";

import { useCallback, useState } from "react";
import { PencilLine } from "lucide-react";
import { DataState } from "@/components/common/data-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useApiResource } from "@/hooks/use-api-resource";
import { formatDate } from "@/lib/format";
import { portalService } from "@/services/portal.service";
import type { PortalProfile } from "@/types/portal";
import { DetailItem } from "../../_components/detail-item";
import { usePortalConfig } from "../../_components/portal-config";
import { PortalPageHeader } from "../../_components/portal-shell";
import { ProfileRequestDialog } from "../../_components/profile-request-dialog";
import { ProfileRequestsList } from "../../_components/profile-requests-list";

export default function MemberProfilePage() {
  const { config } = usePortalConfig();
  const fetchProfile = useCallback(() => portalService.profile(), []);
  const profile = useApiResource(fetchProfile);
  const fetchRequests = useCallback(() => portalService.profileRequests(), []);
  const requests = useApiResource(fetchRequests, config.features.profile_updates);
  const [open, setOpen] = useState(false);

  return (
    <>
      <PortalPageHeader title="My profile" description="The details your cooperative has on file." />
      <DataState
        resource={profile}
        endpoints={["GET /portal/profile"]}
        summary="Your personal and contact details will show here once online access is connected."
      >
        {(data) => (
          <div className="space-y-5">
            <ProfileCard
              profile={data}
              canRequest={config.features.profile_updates}
              onRequest={() => setOpen(true)}
            />
            {config.features.profile_updates && (
              <>
                <ProfileRequestsList resource={requests} />
                <ProfileRequestDialog
                  open={open}
                  onOpenChange={setOpen}
                  profile={data}
                  onSubmitted={requests.refetch}
                />
              </>
            )}
          </div>
        )}
      </DataState>
    </>
  );
}

function ProfileCard({
  profile,
  canRequest,
  onRequest,
}: {
  profile: PortalProfile;
  canRequest: boolean;
  onRequest: () => void;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="text-base">{profile.full_name}</CardTitle>
        {canRequest && (
          <Button size="sm" variant="outline" onClick={onRequest}>
            <PencilLine className="mr-1.5 h-4 w-4" /> Request a change
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-1 gap-y-3 text-sm sm:grid-cols-2 sm:gap-x-6">
          <DetailItem label="Membership number" value={profile.member_number} />
          <DetailItem label="Branch" value={profile.branch_name} />
          <DetailItem label="Birthdate" value={profile.birthdate ? formatDate(profile.birthdate) : null} />
          <DetailItem label="Civil status" value={profile.civil_status} />
          <DetailItem label="Gender" value={profile.gender} />
          <DetailItem label="Mobile number" value={profile.mobile} />
          <DetailItem label="Email address" value={profile.email} />
          <DetailItem label="Address" value={profile.address} />
          <DetailItem label="Occupation" value={profile.occupation} />
          <DetailItem label="Employer" value={profile.employer} />
          <DetailItem label="Government ID" value={profile.government_id} />
          <DetailItem label="Beneficiary" value={profile.beneficiary} />
        </dl>
      </CardContent>
    </Card>
  );
}
