"use client";

import { useState } from "react";
import { MemberSearchPicker } from "@/components/common/member-search-picker";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useDialogOpening, usePermission } from "@/hooks";
import type { MemberOption } from "@/hooks/use-member-search";
import { notifyValidation } from "@/lib/notify";
import type { CdaOfficer } from "@/types/cda";
import type { CdaOfficerInput } from "@/services/cda.service";
import { RecordFields } from "../../_components/record-fields";
import { toDraft, type RecordDraft } from "../../_lib/record-form";
import { OFFICER_DEFAULTS, OFFICER_FIELDS, UNLINKED_FIELDS, officerInput, officerMissing } from "../_lib/officer-form";

/**
 * Add or edit an officer. Linking a member (searching members needs
 * `borrowers:view`) takes the name and sex from the member; otherwise, as for
 * a General Manager who isn't a member, the officer's own name and sex are kept.
 */
export function OfficerDialog({
  officer,
  open,
  onOpenChange,
  onSubmit,
}: {
  officer: CdaOfficer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Resolve to close; reject to keep the dialog open. */
  onSubmit: (input: CdaOfficerInput) => Promise<unknown>;
}) {
  const { can } = usePermission();
  const [draft, setDraft] = useState<RecordDraft>({});
  const [member, setMember] = useState<MemberOption | null>(null);
  const [busy, setBusy] = useState(false);
  if (useDialogOpening(open, officer)) {
    setDraft(toDraft([...UNLINKED_FIELDS, ...OFFICER_FIELDS], officer, OFFICER_DEFAULTS));
    setMember(officer?.member ? { id: officer.member.id, full_name: officer.member.name, borrower_code: officer.member.code ?? undefined } : null);
  }

  async function submit() {
    const missing = officerMissing(draft, member !== null);
    if (missing.length > 0) {
      notifyValidation(missing);
      return;
    }
    setBusy(true);
    const ok = await onSubmit(officerInput(draft, member?.id ?? null)).then(
      () => true,
      () => false,
    );
    setBusy(false);
    if (ok) onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{officer ? "Edit officer" : "Add officer"}</DialogTitle>
          <DialogDescription>For a member, only the name and sex are shown on the CDA forms.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="cda-officer-member">Member</Label>
            <MemberSearchPicker
              id="cda-officer-member"
              value={member}
              onChange={setMember}
              canSearch={can("borrowers:view")}
              placeholder={can("borrowers:view") ? "Link a member (optional)" : "Searching members needs Members: View"}
              showCode
            />
            {member && (
              <Button variant="ghost" size="xs" onClick={() => setMember(null)}>
                Not a member: enter the name instead
              </Button>
            )}
          </div>
          {!member && <RecordFields fields={UNLINKED_FIELDS} draft={draft} onChange={setDraft} disabled={busy} />}
          <RecordFields fields={OFFICER_FIELDS} draft={draft} onChange={setDraft} disabled={busy} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
