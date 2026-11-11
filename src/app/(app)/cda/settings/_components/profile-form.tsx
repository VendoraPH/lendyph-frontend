"use client";

import { useCallback, useMemo, useState } from "react";
import { DataState } from "@/components/common/data-state";
import { PermissionButton } from "@/components/common/permission-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useApiResource, usePermission } from "@/hooks";
import { cdaService } from "@/services";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import { formatDate } from "@/lib/format";
import { notifyError, notifySuccess, notifyValidation } from "@/lib/notify";
import type { CdaOfficer, CdaRegulatoryProfile } from "@/types/cda";
import { RecordFields } from "../../_components/record-fields";
import { ASSET_CLASS_LABELS, labelOf } from "../../_lib/labels";
import { cdaMoney } from "../../_lib/money";
import { missingFields, toDraft, type RecordDraft } from "../../_lib/record-form";
import { officerIdOf, officerOptions } from "../../_lib/screen-gaps";
import { PROFILE_FIELDS, PROFILE_REP_FIELD, PULLED_LABELS, toProfile } from "../_lib/settings-forms";

/** The profile's form state: CDA's own fields plus the representative's pick. */
function profileDraft(profile: CdaRegulatoryProfile["stored"]): RecordDraft {
  return toDraft([...PROFILE_FIELDS, PROFILE_REP_FIELD], profile);
}

/**
 * The authorised representative, picked from the officers register; the name
 * and position shown are the officer's own. Without the register's list the
 * pick can't change, and the save leaves it as stored.
 */
function AuthorisedRep({
  officers,
  failed,
  draft,
  onChange,
  disabled,
}: {
  officers: CdaOfficer[] | null;
  failed: boolean;
  draft: RecordDraft;
  onChange: (draft: RecordDraft) => void;
  disabled: boolean;
}) {
  const chosenId = officerIdOf(draft[PROFILE_REP_FIELD.key]);
  const picked = officers?.find((o) => o.id === chosenId) ?? null;
  const field = useMemo(
    () => ({
      ...PROFILE_REP_FIELD,
      options: officerOptions(officers ?? [], chosenId !== null && !picked ? [{ id: chosenId, name: null }] : [], "no longer in the register"),
    }),
    [officers, chosenId, picked],
  );

  return (
    <div className="space-y-3 rounded-md border p-3">
      <p className="text-sm font-medium">Authorised representative</p>
      {officers === null ? (
        <p className="text-xs text-muted-foreground">
          {failed ? "The officers register couldn't be loaded, so the representative can't be changed now." : "Loading the officers register…"}
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <RecordFields fields={[field]} draft={draft} onChange={onChange} disabled={disabled} />
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] content-start gap-x-3 gap-y-1 text-sm">
            <dt className="text-xs text-muted-foreground">Name</dt>
            <dd>{picked?.name ?? "—"}</dd>
            <dt className="text-xs text-muted-foreground">Position</dt>
            <dd>{picked ? picked.position_title || picked.position_label : "—"}</dd>
          </dl>
        </div>
      )}
    </div>
  );
}

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
  const [draft, setDraft] = useState<RecordDraft>(() => profileDraft(profile.stored));
  const [busy, setBusy] = useState(false);
  const editable = can("cda:settings");
  const officers = useApiResource(useCallback(() => cdaService.listOfficers(), []));
  const officerRows = officers.data?.rows ?? null;

  function save() {
    const missing = missingFields(PROFILE_FIELDS, draft);
    if (missing.length > 0) {
      notifyValidation(missing);
      return;
    }
    setBusy(true);
    cdaService
      .updateProfile(toProfile(draft, officerRows ? [PROFILE_REP_FIELD] : []))
      .then((saved) => {
        setDraft(profileDraft(saved.stored));
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
      <AuthorisedRep
        officers={officerRows}
        failed={!officers.loading && officerRows === null}
        draft={draft}
        onChange={setDraft}
        disabled={busy || !editable}
      />
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
