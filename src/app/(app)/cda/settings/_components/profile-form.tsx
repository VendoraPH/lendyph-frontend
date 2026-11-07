"use client";

import { useCallback, useState } from "react";
import { DataState } from "@/components/common/data-state";
import { PermissionButton } from "@/components/common/permission-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useApiResource } from "@/hooks";
import { cdaService } from "@/services";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import { notifyError, notifySuccess, notifyValidation } from "@/lib/notify";
import type { CdaRegulatoryProfile } from "@/types/cda";
import { RecordFields } from "../../_components/record-fields";
import { fromDraft, missingFields, toDraft, type RecordDraft } from "../../_lib/record-form";
import { PROFILE_FIELDS, toProfile } from "../_lib/settings-forms";

function ProfileEditor({ profile }: { profile: CdaRegulatoryProfile }) {
  const [draft, setDraft] = useState<RecordDraft>(() => toDraft(PROFILE_FIELDS, profile));
  const [busy, setBusy] = useState(false);

  function save() {
    const missing = missingFields(PROFILE_FIELDS, draft);
    if (missing.length > 0) {
      notifyValidation(missing);
      return;
    }
    setBusy(true);
    cdaService
      .updateRegulatoryProfile(toProfile(fromDraft(PROFILE_FIELDS, draft)))
      .then((saved) => {
        setDraft(toDraft(PROFILE_FIELDS, saved));
        notifySuccess("Regulatory profile saved");
      })
      .catch((err: unknown) => notifyError(err, "Could not save the regulatory profile"))
      .finally(() => setBusy(false));
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <RecordFields fields={PROFILE_FIELDS} draft={draft} onChange={setDraft} disabled={busy} />
      </div>
      <div className="flex justify-end">
        <PermissionButton permission="cda:settings" onClick={save} disabled={busy}>
          {busy ? "Saving…" : "Save profile"}
        </PermissionButton>
      </div>
    </div>
  );
}

/** The cooperative's registration facts every CDA report draws on. */
export function ProfileForm() {
  const resource = useApiResource(useCallback(() => cdaService.getRegulatoryProfile(), []));
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Regulatory profile</CardTitle>
        <CardDescription>
          Registration, tax exemption and officers. The CTE status decides whether ATIR and ABR apply.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <DataState
          resource={resource}
          endpoints={[`GET ${API_ENDPOINTS.CDA.REGULATORY_PROFILE}`, `PUT ${API_ENDPOINTS.CDA.REGULATORY_PROFILE}`]}
          summary="The cooperative's CDA registration profile"
        >
          {(profile) => <ProfileEditor profile={profile} />}
        </DataState>
      </CardContent>
    </Card>
  );
}
