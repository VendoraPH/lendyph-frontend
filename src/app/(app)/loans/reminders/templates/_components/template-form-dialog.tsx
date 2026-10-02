"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useDialogOpening } from "@/hooks";
import { notifyError, notifySuccess, notifyValidation } from "@/lib/notify";
import {
  CHANNEL_LABELS,
  TEMPLATE_TYPES,
  TEMPLATE_TYPE_LABELS,
  TEMPLATE_VARIABLES,
  renderTemplateSample,
  smsLength,
  unknownVariables,
} from "@/lib/reminders";
import { reminderService } from "@/services";
import type {
  ReminderChannel,
  ReminderTemplate,
  ReminderTemplateInput,
  ReminderTemplateType,
  TemplatePreview,
} from "@/types/reminder";

interface TemplateFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: ReminderTemplate | null;
  onSaved: () => void;
}

const EMPTY: ReminderTemplateInput = {
  name: "",
  type: "upcoming",
  channel: "sms",
  subject: null,
  body: "",
  language: "en",
  is_active: true,
};

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "fil", label: "Filipino" },
  { value: "ceb", label: "Cebuano" },
];

const CHANNELS = Object.keys(CHANNEL_LABELS) as ReminderChannel[];

function toInput(t: ReminderTemplate): ReminderTemplateInput {
  return {
    name: t.name,
    type: t.type,
    channel: t.channel,
    subject: t.subject,
    body: t.body,
    language: t.language,
    is_active: t.is_active,
  };
}

export function TemplateFormDialog({ open, onOpenChange, template, onSaved }: TemplateFormDialogProps) {
  const [form, setForm] = useState<ReminderTemplateInput>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [serverPreview, setServerPreview] = useState<{ body: string; preview: TemplatePreview } | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  if (useDialogOpening(open, template)) {
    setForm(template ? toInput(template) : EMPTY);
    setServerPreview(null);
  }

  const set = <K extends keyof ReminderTemplateInput>(key: K, value: ReminderTemplateInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  /** Puts `{{key}}` at the cursor, or at the end if the body isn't focused. */
  const insertVariable = (key: string) => {
    const token = `{{${key}}}`;
    const el = bodyRef.current;
    const start = el?.selectionStart ?? form.body.length;
    const end = el?.selectionEnd ?? form.body.length;
    set("body", form.body.slice(0, start) + token + form.body.slice(end));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const isSms = form.channel === "sms";
  const sample = renderTemplateSample(form.body);
  const length = smsLength(sample);
  const unknown = unknownVariables(`${form.subject ?? ""} ${form.body}`);
  // A server preview describes the body it was made for; editing retires it.
  const preview = serverPreview?.body === form.body ? serverPreview.preview : null;

  const runPreview = () => {
    setPreviewing(true);
    const body = form.body;
    reminderService
      .previewTemplate({ channel: form.channel, subject: form.subject, body })
      .then((p) => {
        setPreviewing(false);
        setServerPreview({ body, preview: p });
      })
      .catch((err) => {
        setPreviewing(false);
        notifyError(err, "Could not preview the template.");
      });
  };

  const save = () => {
    const problems: string[] = [];
    if (!form.name.trim()) problems.push("Template name");
    if (!isSms && !form.subject?.trim()) problems.push("Email subject");
    if (!form.body.trim()) problems.push("Message");
    if (unknown.length) problems.push(`Unknown variables: ${unknown.map((u) => `{{${u}}}`).join(", ")}`);
    if (problems.length) {
      notifyValidation(problems);
      return;
    }
    setSaving(true);
    const payload: ReminderTemplateInput = {
      ...form,
      name: form.name.trim(),
      subject: isSms ? null : (form.subject ?? "").trim(),
    };
    const request = template
      ? reminderService.updateTemplate(template.id, payload)
      : reminderService.createTemplate(payload);
    request
      .then(() => {
        setSaving(false);
        notifySuccess(template ? "Template updated" : "Template created");
        onOpenChange(false);
        onSaved();
      })
      .catch((err) => {
        setSaving(false);
        notifyError(err, "Could not save the template.");
      });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle>{template ? "Edit template" : "New template"}</DialogTitle>
          <DialogDescription>
            Write firmly but respectfully: no threats, shaming, or ALL CAPS, and never mention the debt to anyone but
            the borrower.
          </DialogDescription>
        </DialogHeader>

        <div className="grid max-h-[68vh] gap-6 overflow-y-auto lg:grid-cols-[1fr_20rem]">
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="tpl-name">Template name</Label>
                <Input id="tpl-name" value={form.name} onChange={(e) => set("name", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tpl-type">Type</Label>
                <NativeSelect
                  id="tpl-type"
                  className="w-full"
                  value={form.type}
                  onChange={(e) => set("type", e.target.value as ReminderTemplateType)}
                >
                  {TEMPLATE_TYPES.map((t) => (
                    <NativeSelectOption key={t} value={t}>
                      {TEMPLATE_TYPE_LABELS[t]}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tpl-channel">Channel</Label>
                <NativeSelect
                  id="tpl-channel"
                  className="w-full"
                  value={form.channel}
                  onChange={(e) => set("channel", e.target.value as ReminderChannel)}
                >
                  {CHANNELS.map((c) => (
                    <NativeSelectOption key={c} value={c}>
                      {CHANNEL_LABELS[c]}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tpl-language">Language</Label>
                <NativeSelect
                  id="tpl-language"
                  className="w-full"
                  value={form.language}
                  onChange={(e) => set("language", e.target.value)}
                >
                  {LANGUAGES.map((l) => (
                    <NativeSelectOption key={l.value} value={l.value}>
                      {l.label}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
              <label className="flex items-center gap-2 self-end pb-2 text-sm">
                <Switch checked={form.is_active} onCheckedChange={(on) => set("is_active", on)} />
                Active
              </label>
            </div>

            {!isSms && (
              <div className="space-y-1.5">
                <Label htmlFor="tpl-subject">Email subject</Label>
                <Input id="tpl-subject" value={form.subject ?? ""} onChange={(e) => set("subject", e.target.value)} />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="tpl-body">Message</Label>
              <Textarea
                id="tpl-body"
                ref={bodyRef}
                rows={isSms ? 5 : 10}
                value={form.body}
                onChange={(e) => set("body", e.target.value)}
              />
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                {isSms ? (
                  <span>
                    {length.characters} characters · {length.segments} SMS part{length.segments === 1 ? "" : "s"} ·{" "}
                    {length.encoding}
                    {length.encoding === "Unicode" && " (a character like ₱ or an emoji makes every part shorter)"}
                  </span>
                ) : (
                  <span>{form.body.length} characters</span>
                )}
                {unknown.length > 0 && (
                  <span className="text-destructive">
                    Unknown: {unknown.map((u) => `{{${u}}}`).join(", ")}
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="text-sm font-medium">Insert a variable</p>
              <div className="flex flex-wrap gap-1.5">
                {TEMPLATE_VARIABLES.map((v) => (
                  <button
                    key={v.key}
                    type="button"
                    onClick={() => insertVariable(v.key)}
                    className="rounded-md border bg-muted/50 px-2 py-1 text-xs hover:bg-muted"
                    title={`{{${v.key}}} — e.g. ${v.sample}`}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <aside className="space-y-3">
            <div className="rounded-xl border bg-muted/30 p-3">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Sample preview
              </p>
              {!isSms && form.subject && (
                <p className="mb-1 text-sm font-medium">{renderTemplateSample(form.subject)}</p>
              )}
              <p className="whitespace-pre-wrap text-sm">{sample || "Your message appears here."}</p>
            </div>
            <Button variant="outline" className="w-full" onClick={runPreview} disabled={previewing || !form.body.trim()}>
              {previewing ? "Rendering…" : "Preview with the server"}
            </Button>
            {preview && (
              <div className="rounded-xl border p-3">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  As the server renders it
                </p>
                {preview.subject && <p className="mb-1 text-sm font-medium">{preview.subject}</p>}
                <p className="whitespace-pre-wrap text-sm">{preview.body}</p>
                {preview.unknown_variables.length > 0 && (
                  <p className="mt-2 text-xs text-destructive">
                    Not recognised: {preview.unknown_variables.join(", ")}
                  </p>
                )}
              </div>
            )}
          </aside>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : template ? "Save changes" : "Create template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
