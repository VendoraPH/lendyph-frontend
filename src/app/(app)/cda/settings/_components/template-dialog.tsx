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
import type { CdaTemplate, CdaTemplateValidation } from "@/types/cda";
import { RecordFields } from "../../_components/record-fields";
import { missingFields, type RecordDraft } from "../../_lib/record-form";
import { TEMPLATE_FIELDS, draftToTemplate, templateToDraft } from "../_lib/settings-forms";

/**
 * Create a draft template or edit one (carried over from #510 by Augustin).
 * An active template can't change: a new CDA format is a new version. Check
 * asks the server to validate the definition before saving. `template`
 * undefined is closed, null is new.
 */
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
  const [check, setCheck] = useState<CdaTemplateValidation | null>(null);
  if (useDialogOpening(open, template)) {
    setDraft(templateToDraft(template ?? null));
    setCheck(null);
  }
  const fields = template ? TEMPLATE_FIELDS.filter((f) => f.key !== "report_type") : TEMPLATE_FIELDS;

  function body() {
    const missing = missingFields(fields, draft);
    if (missing.length > 0) {
      notifyValidation(missing);
      return null;
    }
    const input = draftToTemplate({ ...draft, report_type: template?.report_type ?? draft.report_type });
    if (typeof input === "string") {
      notifyValidation([input]);
      return null;
    }
    return input;
  }

  function validate() {
    const input = body();
    if (!input?.report_type) return;
    setBusy(true);
    cdaService
      .validateTemplate(input.report_type, input.definition)
      .then(setCheck)
      .catch((err: unknown) => notifyError(err, "Could not check the definition"))
      .finally(() => setBusy(false));
  }

  function save() {
    const input = body();
    if (!input) return;
    setBusy(true);
    const request = template ? cdaService.updateTemplate(template.id, input) : cdaService.createTemplate(input);
    request
      .then(() => {
        notifySuccess(template ? "Template saved" : "Draft template created");
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
          <DialogTitle>{template ? `Edit draft ${template.name}` : "New draft template"}</DialogTitle>
          <DialogDescription>
            Drafts can change; an active template can&apos;t. Activate it once it checks clean, and retire the old one so
            past reports keep the template they were prepared on.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2 [&_textarea]:min-h-64 [&_textarea]:font-mono [&_textarea]:text-xs">
          <RecordFields fields={fields} draft={draft} onChange={setDraft} disabled={busy} />
        </div>
        {check && (
          <div className="rounded-md border p-3 text-sm">
            {check.valid ? (
              <p className="text-emerald-700 dark:text-emerald-400">The definition checks clean.</p>
            ) : (
              <ul className="list-disc space-y-1 pl-5 text-red-700 dark:text-red-400">
                {check.errors.map((e) => (
                  <li key={`${e.path}-${e.message}`}>
                    <span className="font-mono text-xs">{e.path}</span>: {e.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="outline" onClick={validate} disabled={busy}>
            Check definition
          </Button>
          <Button onClick={save} disabled={busy}>
            {busy ? "Saving…" : "Save draft"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
