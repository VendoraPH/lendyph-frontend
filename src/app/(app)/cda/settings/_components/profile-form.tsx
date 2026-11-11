"use client";

import { useCallback, useState } from "react";
import { DataState } from "@/components/common/data-state";
import { PermissionButton } from "@/components/common/permission-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useApiResource, usePermission } from "@/hooks";
import { cdaService } from "@/services";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import { formatDate } from "@/lib/format";
import { notifyError, notifySuccess, notifyValidation } from "@/lib/notify";
import type { CdaRegulatoryProfile } from "@/types/cda";
import { RecordFields } from "../../_components/record-fields";
import { ASSET_CLASS_LABELS, labelOf } from "../../_lib/labels";
import { cdaMoney } from "../../_lib/money";
import { missingFields, toDraft, type RecordDraft } from "../../_lib/record-form";
import { PROFILE_FIELDS, PULLED_LABELS, toProfile } from "../_lib/settings-forms";

function Pulled({ profile }: { profile: CdaRegulatoryProfile }) {
  const suggested = profile.asset_class_suggested;
  return (
    <div className="space-y-2 rounded-md border bg-muted/30 p-3 text-sm">
      <p className="font-medium">From elsewhere in the system (read only)</p>
      <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
        {Object.entries(PULLED_LABELS).map(([key, label]) => {
          const item = profile.pulled[key];
          return (
            <div key={key}>
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd>
                {item?.value === null || item?.value === undefined || item.value === "" ? "Not recorded" : String(item.value)}
                {item?.source && <span className="block text-xs text-muted-foreground">{item.source}</span>}
              </dd>
            </div>
          );
        })}
      </dl>
      {suggested && (
        <p className="text-xs text-muted-foreground">
          Total assets of {cdaMoney(suggested.total_assets)} as of {formatDate(suggested.as_of)} suggest a{" "}
          {labelOf(ASSET_CLASS_LABELS, suggested.asset_class).toLowerCase()} cooperative ({suggested.source}).
        </p>
      )}
    </div>
  );
}

function ProfileEditor({ profile }: { profile: CdaRegulatoryProfile }) {
  const { can } = usePermission();
  const [draft, setDraft] = useState<RecordDraft>(() => toDraft(PROFILE_FIELDS, profile.stored));
  const [busy, setBusy] = useState(false);
  const editable = can("cda:settings");

  function save() {
    const missing = missingFields(PROFILE_FIELDS, draft);
    if (missing.length > 0) {
      notifyValidation(missing);
      return;
    }
    setBusy(true);
    cdaService
      .updateProfile(toProfile(draft))
      .then((saved) => {
        setDraft(toDraft(PROFILE_FIELDS, saved.stored));
        notifySuccess("Regulatory profile saved");
      })
      .catch((err: unknown) => notifyError(err, "Could not save the regulatory profile"))
      .finally(() => setBusy(false));
  }

  return (
    <div className="space-y-4">
      <Pulled profile={profile} />
      <div className="grid gap-4 sm:grid-cols-2">
        <RecordFields fields={PROFILE_FIELDS} draft={draft} onChange={setDraft} disabled={busy || !editable} />
      </div>
      <div className="flex justify-end">
        <PermissionButton permission="cda:settings" onClick={save} disabled={busy}>
          {busy ? "Saving…" : "Save profile"}
        </PermissionButton>
      </div>
    </div>
  );
}

/** The cooperative's CDA registration facts; the CTE decides whether ATIR and ABR apply. */
export function ProfileForm() {
  const resource = useApiResource(useCallback(() => cdaService.getProfile(), []));
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Regulatory profile</CardTitle>
        <CardDescription>
          Registration, tax exemption and classification. The name, address and contact are kept in Settings › Branding.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <DataState resource={resource} endpoints={[`GET ${API_ENDPOINTS.CDA.REGULATORY_PROFILE}`]} summary="The cooperative's CDA profile">
          {(profile) => <ProfileEditor profile={profile} />}
        </DataState>
      </CardContent>
    </Card>
  );
}
