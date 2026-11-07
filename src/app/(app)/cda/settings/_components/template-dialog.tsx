"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useDialogOpening } from "@/hooks";
import { notifyError, notifySuccess, notifyValidation } from "@/lib/notify";
import { cdaService } from "@/services";
import type { CdaTemplate } from "@/types/cda";
import { RecordFields } from "../../_components/record-fields";
import { missingFields, type RecordDraft } from "../../_lib/record-form";
import { TEMPLATE_FIELDS, draftToTemplate, templateToDraft } from "../_lib/settings-forms";

/** Create or edit a report template. `template` undefined = closed, null = new. */
export function TemplateDialog({
  template,
  onClose,
  onSaved,
}: {
  template: CdaTemplate | null | undefined;
  onClose: () => void;
  onSaved: () => void;
}) {
  const open = template !== undefined;
  const [draft, setDraft] = useState<RecordDraft>({});
  const [busy, setBusy] = useState(false);
  if (useDialogOpening(open, template)) setDraft(templateToDraft(template ?? null));

  function save() {
    const missing = missingFields(TEMPLATE_FIELDS, draft);
    if (missing.length > 0) {
      notifyValidation(missing);
      return;
    }
    const input = draftToTemplate(draft);
    if (typeof input === "string") {
      notifyValidation([input]);
      return;
    }
    setBusy(true);
    const request = template ? cdaService.updateTemplate(template.id, input) : cdaService.createTemplate(input);
    request
      .then(() => {
        notifySuccess(template ? "Template updated" : "Template created");
        onSaved();
        onClose();
      })
      .catch((err: unknown) => notifyError(err, "Could not save the template"))
      .finally(() => setBusy(false));
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{template ? "Edit template" : "New template"}</DialogTitle>
          <DialogDescription>
            A new CDA format is a new version, not an edit: retire the old one so past reports keep the template they
            were prepared on.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2 [&_textarea]:min-h-64 [&_textarea]:font-mono [&_textarea]:text-xs">
          <RecordFields fields={TEMPLATE_FIELDS} draft={draft} onChange={setDraft} disabled={busy} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
