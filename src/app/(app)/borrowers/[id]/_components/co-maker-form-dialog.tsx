"use client";

import { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { UserPlus, Loader2, Plus, X } from "lucide-react";
import { usePermission } from "@/hooks";
import type { CoMaker, Loan } from "@/types";
import {
  coMakerService,
  type CreateCoMakerData,
  type UpdateCoMakerData,
} from "@/services/co-maker.service";
import {
  coMakerDetailsProblems,
  coMakerToForm,
  coMakerUpdatePayload,
  mergeFreshIntoForm,
  type CoMakerDetailsErrors,
  type CoMakerFormData,
} from "@/lib/co-maker-edit";
import {
  checkCoMakerId,
  type CoMakerIdCheck,
  type CoMakerIdErrors,
  type ReadyCoMakerId,
} from "@/lib/co-maker-valid-id";
import type { CoMakerSaveResult } from "@/lib/co-maker-save";
import { useCoMakerIdDraft } from "../_hooks/use-co-maker-id-draft";
import { useCoMakerValidIds } from "../_hooks/use-co-maker-valid-ids";
import { CoMakerFormFields } from "./co-maker-form-fields";
import { CoMakerValidIdFields } from "./co-maker-valid-id-fields";
import { CoMakerValidIdsOnFile } from "./co-maker-valid-ids-on-file";

/**
 * What the dialogs hand their parent to save, and get back: how it ended,
 * which decides whether the dialog closes. The parent does the requests and
 * says how they went; see `saveCoMaker` / `coMakerSaveNotice`.
 */
export type AddCoMakerHandler = (
  data: CreateCoMakerData,
  validId: ReadyCoMakerId | null
) => Promise<CoMakerSaveResult>;
export type AddCoMakerIdHandler = (
  coMakerId: number,
  validId: ReadyCoMakerId
) => Promise<CoMakerSaveResult>;
export type EditCoMakerHandler = (
  id: number,
  data: UpdateCoMakerData,
  validId: ReadyCoMakerId | null
) => Promise<CoMakerSaveResult>;

function emptyForm(): CoMakerFormData {
  return {
    first_name: "",
    middle_name: "",
    last_name: "",
    suffix: "",
    relationship: "",
    phone: "",
    address: "",
    occupation: "",
    employer: "",
    monthly_income: "",
    loan_id: "",
  };
}

function generateCoMakerCode(count: number): string {
  const year = new Date().getFullYear();
  const seq = String(count + 1).padStart(4, "0");
  return `CM-${year}${seq}`;
}

function coMakerCreatePayload(form: CoMakerFormData): CreateCoMakerData {
  return {
    first_name: form.first_name,
    last_name: form.last_name,
    ...(form.middle_name && { middle_name: form.middle_name }),
    ...(form.suffix && { suffix: form.suffix }),
    relationship_to_borrower: form.relationship,
    contact_number: form.phone,
    ...(form.address && { address: form.address }),
    ...(form.occupation && { occupation: form.occupation }),
    ...(form.employer && { employer: form.employer }),
    ...(form.monthly_income && { monthly_income: Number(form.monthly_income) }),
  };
}

function withoutKey<T extends object>(errors: T, key: PropertyKey): T {
  if (!(key in errors)) return errors;
  const next = { ...errors };
  delete next[key as keyof T];
  return next;
}

// Field ids in the order they appear, so a failed check can put focus on the
// first thing that needs fixing.
const FIELD_ORDER: [string, string][] = [
  ["first_name", "cm_first_name"],
  ["last_name", "cm_last_name"],
  ["relationship", "cm_relationship"],
  ["phone", "cm_phone"],
  ["type", "cm_id_type"],
  ["id_number", "cm_id_number"],
  ["custom_type_name", "cm_id_custom_type"],
  ["file", "cm_id_file"],
];

function focusFirstProblem(details: CoMakerDetailsErrors, id: CoMakerIdErrors) {
  const problems: Record<string, string | undefined> = { ...details, ...id };
  const first = FIELD_ORDER.find(([field]) => problems[field]);
  if (first) document.getElementById(first[1])?.focus();
}

function hasProblems(details: CoMakerDetailsErrors, idCheck: CoMakerIdCheck): boolean {
  return Object.keys(details).length > 0 || idCheck.status === "invalid";
}

// The save handlers report failure as a result, never by throwing; this only
// covers one that throws anyway, so a dialog is never left locked mid-save.
// Deliberately not try/finally: the React Compiler behind the hooks lint rules
// skips any component that contains a `finally`, silently switching those
// rules off for it.
function unexpectedFailure(error: unknown): CoMakerSaveResult {
  return { status: "failed", error };
}

const submitClass = "bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark";

function ValidIdHeading({
  hint,
  headingRef,
}: {
  hint?: string;
  headingRef?: React.Ref<HTMLHeadingElement>;
}) {
  return (
    <div>
      {/* Focusable from script only: where focus goes when a removed ID's
          row disappears, so it isn't dropped on the dialog as a whole. */}
      <h3 ref={headingRef} tabIndex={-1} className="text-sm font-medium outline-none">
        Valid ID
      </h3>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

// ── Add Co-Maker Dialog ──

interface AddCoMakerDialogProps {
  loans: Loan[];
  borrowerId: number;
  coMakerCount: number;
  existingCoMakers: CoMaker[];
  onAdd: AddCoMakerHandler;
  onAddId: AddCoMakerIdHandler;
}

export function AddCoMakerDialog({
  loans,
  borrowerId,
  coMakerCount,
  existingCoMakers,
  onAdd,
  onAddId,
}: AddCoMakerDialogProps) {
  const [form, setForm] = useState<CoMakerFormData>(emptyForm());
  const [detailErrors, setDetailErrors] = useState<CoMakerDetailsErrors>({});
  const validId = useCoMakerIdDraft();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  // Set once the co-maker exists but its ID did not save. From then on the
  // dialog saves only the ID, for that co-maker: submitting again must never
  // create the co-maker a second time.
  const [savedCoMakerId, setSavedCoMakerId] = useState<number | null>(null);
  const idOnly = savedCoMakerId !== null;
  const retryNotice = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // The form may be scrolled anywhere when the save comes back. The notice
    // sits above the ID fields: scroll it to the top, with them just below.
    if (idOnly) retryNotice.current?.scrollIntoView({ block: "start" });
  }, [idOnly]);

  const selectedLoanHasCoMaker = form.loan_id
    ? existingCoMakers.some((cm) => cm.loan_id === form.loan_id)
    : false;

  const update = (field: keyof CoMakerFormData, value: string | number | undefined) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setDetailErrors((prev) => withoutKey(prev, field));
  };

  const resetForm = () => {
    setForm(emptyForm());
    setDetailErrors({});
    validId.reset();
    setSavedCoMakerId(null);
  };

  const handleOpenChange = (next: boolean) => {
    // A save in flight finishes first; its outcome decides whether to close.
    if (!next && saving) return;
    setOpen(next);
    if (!next) resetForm();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;

    const details = idOnly ? {} : coMakerDetailsProblems(form);
    const idCheck = checkCoMakerId(validId.draft, [], { required: idOnly });
    const idErrors = idCheck.status === "invalid" ? idCheck.errors : {};
    setDetailErrors(details);
    validId.setErrors(idErrors);
    if (hasProblems(details, idCheck)) {
      focusFirstProblem(details, idErrors);
      return;
    }
    const readyId = idCheck.status === "ready" ? idCheck.id : null;
    // Unreachable — `required` makes a blank draft invalid once the co-maker
    // exists — but it must never fall through to onAdd and create it again.
    if (savedCoMakerId !== null && !readyId) return;

    setSaving(true);
    const result = await (
      savedCoMakerId !== null && readyId
        ? onAddId(savedCoMakerId, readyId)
        : onAdd(coMakerCreatePayload(form), readyId)
    ).catch(unexpectedFailure);
    setSaving(false);

    if (result.status === "saved") {
      setOpen(false);
      resetForm();
    } else if (result.status === "id_failed") {
      setSavedCoMakerId(result.coMakerId);
    }
    // "failed": nothing was saved, so everything stays as it was entered.
  };

  const submitLabel = idOnly
    ? saving
      ? "Saving ID…"
      : "Save ID"
    : saving
      ? "Adding…"
      : "Add Co-Maker";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        className="inline-flex items-center justify-center gap-2 rounded-md bg-brand-orange px-4 py-2 text-sm font-medium text-brand-orange-foreground hover:bg-brand-orange-dark transition-colors"
      >
        <UserPlus className="h-4 w-4" />
        Add Co-Maker
      </DialogTrigger>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Add Co-Maker</DialogTitle>
          <DialogDescription>
            Register a co-maker linked to a loan for this borrower.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            <CoMakerFormFields
              form={form}
              update={update}
              loans={loans}
              errors={detailErrors}
              disabled={saving || idOnly}
              loanWarning={selectedLoanHasCoMaker ? "This loan already has a co-maker assigned." : undefined}
            />
            <section className="space-y-3 border-t pt-4">
              {idOnly && (
                <div
                  ref={retryNotice}
                  role="status"
                  className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2"
                >
                  <p className="text-sm font-medium">The co-maker is saved. Its ID isn&apos;t yet.</p>
                  <p className="text-xs text-muted-foreground">
                    Fix the ID below and save it, or close and add it later from Edit.
                  </p>
                </div>
              )}
              <ValidIdHeading
                hint={idOnly ? undefined : "Optional. To save one, give its type and a photo."}
              />
              <CoMakerValidIdFields
                draft={validId.draft}
                errors={validId.errors}
                onChange={validId.change}
                onPickFile={validId.pickFile}
                disabled={saving}
              />
            </section>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={saving}
            >
              {idOnly ? "Close" : "Cancel"}
            </Button>
            <Button type="submit" className={submitClass} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {submitLabel}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Edit Co-Maker Dialog ──

interface EditCoMakerDialogProps {
  coMaker: CoMaker;
  loans: Loan[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: EditCoMakerHandler;
}

export function EditCoMakerDialog({
  coMaker,
  loans,
  open,
  onOpenChange,
  onSave,
}: EditCoMakerDialogProps) {
  // Start from the list snapshot so the form is usable immediately; a fresh
  // copy from the detail endpoint fills in behind it as soon as it arrives.
  // This catches any fields another user (or an admin) edited since the list
  // was last fetched.
  const [fresh, setFresh] = useState<CoMaker>(coMaker);
  const [form, setForm] = useState<CoMakerFormData>(() => coMakerToForm(coMaker));
  const [detailErrors, setDetailErrors] = useState<CoMakerDetailsErrors>({});
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  // Fields the person has typed in. The fresh copy never overwrites them.
  const touched = useRef(new Set<keyof CoMakerFormData>());
  const validId = useCoMakerIdDraft();
  const idsOnFile = useCoMakerValidIds(coMaker.id, open);
  const [addingAnother, setAddingAnother] = useState(false);
  const idHeading = useRef<HTMLHeadingElement>(null);
  const canRemoveIds = usePermission().can("borrowers:delete");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setRefreshing(true);
    coMakerService
      .detail(coMaker.id)
      .then((data) => {
        if (cancelled) return;
        setFresh(data);
        const typed = new Set(touched.current);
        setForm((current) => mergeFreshIntoForm(coMakerToForm(data), current, typed));
      })
      .catch(() => {
        // Fall back to the list snapshot silently — the form is already
        // populated from it, so the user can still edit.
      })
      .finally(() => {
        if (!cancelled) setRefreshing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, coMaker.id]);

  const update = (field: keyof CoMakerFormData, value: string | number | undefined) => {
    touched.current.add(field);
    setForm((prev) => ({ ...prev, [field]: value }));
    setDetailErrors((prev) => withoutKey(prev, field));
  };

  const hasIdsOnFile = idsOnFile.ids.length > 0;
  // With an ID on file, adding another is a deliberate step; with none, the
  // fields are simply there.
  const showIdFields = idsOnFile.status !== "loading" && (!hasIdsOnFile || addingAnother);
  const removing = idsOnFile.removingId !== null;

  const requestOpenChange = (next: boolean) => {
    // A save in flight finishes first; its outcome decides whether to close.
    if (!next && saving) return;
    onOpenChange(next);
  };

  // A disclosure: the button stays put and keeps focus, and the fields open
  // below it. Closing it discards what was entered there.
  const toggleAddingAnother = () => {
    if (addingAnother) validId.reset();
    setAddingAnother(!addingAnother);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving || removing) return;

    const details = coMakerDetailsProblems(form);
    const idCheck: CoMakerIdCheck = showIdFields
      ? checkCoMakerId(validId.draft, idsOnFile.ids, { canRemove: canRemoveIds })
      : { status: "none" };
    const idErrors = idCheck.status === "invalid" ? idCheck.errors : {};
    setDetailErrors(details);
    validId.setErrors(idErrors);
    if (hasProblems(details, idCheck)) {
      focusFirstProblem(details, idErrors);
      return;
    }

    // The API's keys only — never the co-maker object with edits spread over
    // it. See coMakerUpdatePayload for how that shape lost every name, phone
    // and relationship edit while still reporting success.
    setSaving(true);
    const result = await onSave(
      coMaker.id,
      coMakerUpdatePayload(form),
      idCheck.status === "ready" ? idCheck.id : null
    ).catch(unexpectedFailure);
    setSaving(false);

    if (result.status === "saved") onOpenChange(false);
    // Otherwise the dialog stays open with everything as entered. After
    // "id_failed" the details are already saved: saving again re-sends the
    // same details, which changes nothing, and retries the ID.
  };

  return (
    <Dialog open={open} onOpenChange={requestOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Edit Co-Maker
            {refreshing && (
              <Loader2
                className="h-3.5 w-3.5 animate-spin text-muted-foreground"
                aria-label="Refreshing latest data"
              />
            )}
          </DialogTitle>
          <DialogDescription>
            Update co-maker profile for {fresh.full_name ?? coMaker.full_name} —{" "}
            <span className="font-mono text-brand-orange">
              {fresh.co_maker_code ?? coMaker.co_maker_code}
            </span>
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            <CoMakerFormFields
              form={form}
              update={update}
              loans={loans}
              errors={detailErrors}
              disabled={saving}
            />
            <section className="space-y-3 border-t pt-4">
              <ValidIdHeading headingRef={idHeading} />
              <CoMakerValidIdsOnFile
                ids={idsOnFile.ids}
                status={idsOnFile.status}
                removingId={idsOnFile.removingId}
                onRetry={idsOnFile.reload}
                onRemove={(validIdId) =>
                  idsOnFile.remove(validIdId, () => idHeading.current?.focus())
                }
                disabled={saving}
              />
              {hasIdsOnFile && (
                <Button
                  id="cm_id_add_another"
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-expanded={addingAnother}
                  aria-controls="cm_id_new"
                  onClick={toggleAddingAnother}
                  disabled={saving}
                >
                  {addingAnother ? (
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  {addingAnother ? "Don't add another ID" : "Add another ID"}
                </Button>
              )}
              <div id="cm_id_new">
                {showIdFields && (
                  <CoMakerValidIdFields
                    draft={validId.draft}
                    errors={validId.errors}
                    onChange={validId.change}
                    onPickFile={validId.pickFile}
                    disabled={saving}
                  />
                )}
              </div>
            </section>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => requestOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" className={submitClass} disabled={saving || removing}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {saving ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
