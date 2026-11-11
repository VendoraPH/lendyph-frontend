"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/portal/form-field";
import { LoadState } from "@/components/portal/load-state";
import { useConfirmedSubmit } from "@/lib/portal/hooks/use-confirmed-submit";
import { usePortalResource } from "@/lib/portal/hooks/use-portal-resource";
import { REQUEST_TYPE, labelOf } from "@/lib/portal/labels";
import { portalService } from "@/lib/portal/portal-api";
import {
  EMPTY_OPENING,
  EMPTY_WITHDRAWAL,
  REQUEST_TYPES,
  openingBody,
  openingErrors,
  profileBody,
  profileErrors,
  withdrawalBody,
  withdrawalErrors,
  type FormErrors,
  type OpeningForm,
  type ProfileForm,
  type WithdrawalForm,
} from "@/lib/portal/request-forms";
import { CONFIRMS } from "@/lib/portal/server-confirm";
import type { RequestOptions, RequestType } from "@/lib/portal/types";
import { cn } from "@/lib/utils";
import { OpeningFields } from "./opening-fields";
import { ProfileFields } from "./profile-fields";
import { WithdrawalFields } from "./withdrawal-fields";

interface NewRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialType?: RequestType;
}

/**
 * A new request (carried over from #513 by Augustin, cut to the three v1
 * types). The choices come from `/portal/requests/options`; the form opens
 * fresh each time.
 */
export function NewRequestDialog({ open, onOpenChange, initialType }: NewRequestDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md" className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New request</DialogTitle>
          <DialogDescription>Your branch reviews every request. Nothing changes until they decide.</DialogDescription>
        </DialogHeader>
        {open && <RequestForm initialType={initialType} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function RequestForm({ initialType, onDone }: { initialType?: RequestType; onDone: () => void }) {
  const fetcher = useCallback(() => portalService.requestOptions(), []);
  const { data, loading, error, reload } = usePortalResource(fetcher, "We couldn't load the request options. Please try again.");
  return (
    <LoadState loading={loading} error={error} onRetry={reload}>
      {data && <RequestFormBody options={data} initialType={initialType} onDone={onDone} />}
    </LoadState>
  );
}

function RequestFormBody({ options, initialType, onDone }: { options: RequestOptions; initialType?: RequestType; onDone: () => void }) {
  const router = useRouter();
  const types = REQUEST_TYPES.filter((t) => options.types[t]);
  const [type, setType] = useState<RequestType | null>(initialType && types.includes(initialType) ? initialType : (types[0] ?? null));
  const [withdrawal, setWithdrawal] = useState<WithdrawalForm>(EMPTY_WITHDRAWAL);
  const [opening, setOpening] = useState<OpeningForm>(EMPTY_OPENING);
  const [profile, setProfile] = useState<ProfileForm>({});
  const [remarks, setRemarks] = useState("");
  const [localErrors, setLocalErrors] = useState<FormErrors>({});
  const { submitting, submit, fieldErrors } = useConfirmedSubmit();
  const errors = { ...fieldErrors, ...localErrors };

  if (type === null) {
    return <p className="text-sm text-muted-foreground">Requests are turned off by your cooperative right now.</p>;
  }

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const found = type === "savings_withdrawal" ? withdrawalErrors(withdrawal) : type === "savings_opening" ? openingErrors(opening) : profileErrors(profile);
    setLocalErrors(found);
    if (Object.keys(found).length > 0) return;
    const body = type === "savings_withdrawal" ? withdrawalBody(withdrawal, remarks) : type === "savings_opening" ? openingBody(opening, remarks) : profileBody(profile, remarks);
    submit((key) => portalService.createRequest(body, key), {
      expect: CONFIRMS.created,
      success: (created) => `Request sent. Reference ${created.reference}`,
      failure: "We couldn't send your request. Please try again.",
      onConfirmed: (created) => {
        onDone();
        router.push(`/member/requests/${created.id}`);
      },
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      {types.length > 1 && (
        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-medium">What do you need?</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {types.map((t) => (
              <label
                key={t}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-lg border p-2.5 text-sm has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
                  type === t && "border-primary bg-primary/5 font-medium",
                )}
              >
                <input
                  type="radio"
                  name="request-type"
                  value={t}
                  checked={type === t}
                  onChange={() => {
                    setType(t);
                    setLocalErrors({});
                  }}
                  className="accent-primary"
                />
                {labelOf(REQUEST_TYPE, t)}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      {type === "savings_withdrawal" && <WithdrawalFields form={withdrawal} onChange={setWithdrawal} options={options} errors={errors} />}
      {type === "savings_opening" && <OpeningFields form={opening} onChange={setOpening} options={options} errors={errors} />}
      {type === "profile_update" && <ProfileFields form={profile} onChange={setProfile} options={options} errors={errors} />}
      <FormField id="rq-remarks" label="Note for your branch (optional)" error={errors.remarks}>
        <Textarea id="rq-remarks" maxLength={500} rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
      </FormField>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting && <Spinner className="h-4 w-4" />}
          Send request
        </Button>
      </DialogFooter>
    </form>
  );
}
