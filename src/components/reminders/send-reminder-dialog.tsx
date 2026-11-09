"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Clock, Mail, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { useDialogOpening, usePermission } from "@/hooks";
import { formatCurrencyExact, formatDate } from "@/lib/format";
import { getErrorMessage } from "@/lib/api-error";
import { notifyError, notifySuccess } from "@/lib/notify";
import { TestModeBanner } from "./test-mode";
import {
  NO_TEMPLATE_FITS,
  TEMPLATE_TYPE_LABELS,
  manualSendWording,
  offeredTemplates,
  recipientLabel,
  rowTestMode,
  type SendMode,
} from "@/lib/reminders";
import { reminderService } from "@/services";
import type {
  ManualReminderPreview,
  ManualSendChannel,
  ReminderTemplateType,
} from "@/types/reminder";

interface SendReminderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loanId: number;
  /**
   * The server's suggestion (`suggested_template_type`). Without one the
   * template starts unselected and staff pick it.
   */
  defaultTemplate?: ReminderTemplateType | null;
  onSent?: () => void;
  /** The deployment's test mode, from the settings; null when not known. */
  testMode?: SendMode;
  /**
   * The server's `allowed_template_types` for the loan today; only these are
   * offered. Absent on an older answer: every manual reminder type.
   */
  allowedTemplates?: ReminderTemplateType[];
}

const CHANNEL_OPTIONS: { value: ManualSendChannel; label: string }[] = [
  { value: "sms", label: "SMS" },
  { value: "email", label: "Email" },
  { value: "both", label: "SMS and Email" },
];

const offeredOrNull = (
  t: ReminderTemplateType | null,
  offered: readonly ReminderTemplateType[],
): ReminderTemplateType | null => (t && offered.includes(t) ? t : null);

/** The preview for one channel/template choice, tagged with what it answers. */
interface PreviewResult {
  key: string;
  preview: ManualReminderPreview | null;
  error: string | null;
}

/**
 * Manual reminder for one loan. The message, amount and due date all come
 * from the server's preview, and so do the reasons it can't be sent (paused,
 * no mobile number, outside contact hours) — Send stays disabled while any
 * apply, rather than letting the request fail.
 */
export function SendReminderDialog({
  open,
  onOpenChange,
  loanId,
  defaultTemplate = null,
  onSent,
  testMode = null,
  allowedTemplates,
}: SendReminderDialogProps) {
  const summaryOffered = offeredTemplates(allowedTemplates);
  // A null recipient is hidden or missing; only `borrowers:view` tells which.
  const canSeeContacts = usePermission().can("borrowers:view");
  const [channel, setChannel] = useState<ManualSendChannel>("sms");
  const [template, setTemplate] = useState<ReminderTemplateType | null>(() => offeredOrNull(defaultTemplate, summaryOffered));
  const [result, setResult] = useState<PreviewResult | null>(null);
  const [sending, setSending] = useState(false);

  // A preview from an earlier opening may no longer hold (the loan was paused
  // since, or paid), so each opening waits for a fresh one.
  if (useDialogOpening(open, loanId)) {
    setChannel("sms");
    setTemplate(offeredOrNull(defaultTemplate, summaryOffered));
    setResult(null);
  }

  const key = `${loanId}|${channel}|${template ?? ""}`;

  useEffect(() => {
    if (!open || !template) return;
    let cancelled = false;
    reminderService
      .previewManual({ loan_id: loanId, channel, template_type: template })
      .then((preview) => {
        if (!cancelled) setResult({ key, preview, error: null });
      })
      .catch((err) => {
        if (!cancelled) {
          setResult({ key, preview: null, error: getErrorMessage(err, "Could not load the preview.") });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, loanId, channel, template, key]);

  const current = template && result?.key === key ? result : null;
  const preview = current?.preview ?? null;
  // The preview's own test_mode is the server's answer for this send; until
  // it arrives, the settings' mode. Live words only on a known live mode.
  const mode = preview ? rowTestMode(preview, testMode) : testMode;
  const wording = manualSendWording(mode);
  // The preview's own list is the latest answer; the summary's until then.
  const offered = preview?.allowed_template_types ? offeredTemplates(preview.allowed_template_types) : summaryOffered;
  const nothingFits = offered.length === 0;
  const blocked = preview ? preview.blocked_reasons.length > 0 : true;

  const send = () => {
    if (!template) return;
    setSending(true);
    reminderService
      .sendManual({ loan_id: loanId, channel, template_type: template })
      .then(() => {
        setSending(false);
        notifySuccess(wording.toastTitle, wording.toastBody);
        onOpenChange(false);
        onSent?.();
      })
      .catch((err) => {
        setSending(false);
        notifyError(err, "Could not send the reminder.");
      });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{wording.title}</DialogTitle>
          <DialogDescription>
            Queues one reminder now, outside the automatic schedule. It shows in Message History.
          </DialogDescription>
        </DialogHeader>

        <TestModeBanner testMode={mode} enabled={null} />

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="manual-channel">Channel</Label>
            <NativeSelect
              id="manual-channel"
              className="w-full"
              value={channel}
              onChange={(e) => setChannel(e.target.value as ManualSendChannel)}
            >
              {CHANNEL_OPTIONS.map((o) => (
                <NativeSelectOption key={o.value} value={o.value}>
                  {o.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="manual-template">Template</Label>
            <NativeSelect
              id="manual-template"
              className="w-full"
              value={template ?? ""}
              disabled={nothingFits && !template}
              onChange={(e) => setTemplate((e.target.value || null) as ReminderTemplateType | null)}
            >
              <NativeSelectOption value="" disabled>
                Choose a template
              </NativeSelectOption>
              {offered.map((t) => (
                <NativeSelectOption key={t} value={t}>
                  {TEMPLATE_TYPE_LABELS[t]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
        </div>

        <div className="max-h-[50vh] space-y-3 overflow-y-auto">
          {!template ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {nothingFits ? NO_TEMPLATE_FITS : "Choose a template to see the message the member would get."}
            </p>
          ) : !current ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Spinner className="h-4 w-4" /> Loading preview…
            </div>
          ) : current.error ? (
            <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {current.error}
            </p>
          ) : preview ? (
            <>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-lg border bg-muted/40 p-3 text-sm">
                <dt className="text-muted-foreground">Member</dt>
                <dd className="text-right font-medium">{preview.borrower_name}</dd>
                <dt className="text-muted-foreground">Loan</dt>
                <dd className="text-right">{preview.loan_account_number}</dd>
                {preview.due_date && (
                  <>
                    <dt className="text-muted-foreground">
                      Due{preview.installment_number ? ` (installment ${preview.installment_number})` : ""}
                    </dt>
                    <dd className="text-right">{formatDate(preview.due_date)}</dd>
                  </>
                )}
                {preview.amount_due !== null && (
                  <>
                    <dt className="text-muted-foreground">Amount due</dt>
                    <dd className="text-right font-medium">{formatCurrencyExact(preview.amount_due)}</dd>
                  </>
                )}
              </dl>

              {preview.notes && preview.notes.length > 0 && (
                <ul className="space-y-0.5 rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
                  {preview.notes.map((n) => (
                    <li key={n} className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      {n}
                    </li>
                  ))}
                </ul>
              )}

              {preview.blocked_reasons.length > 0 && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
                  <p className="flex items-center gap-1.5 font-medium">
                    <AlertTriangle className="h-4 w-4" /> {wording.blocked}
                  </p>
                  <ul className="mt-1 list-disc pl-5">
                    {preview.blocked_reasons.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}

              {preview.messages.map((m) => (
                <div key={m.channel} className="rounded-lg border p-3">
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {m.channel === "sms" ? <MessageSquare className="h-3.5 w-3.5" /> : <Mail className="h-3.5 w-3.5" />}
                    {m.channel === "sms" ? "SMS" : "Email"} · {recipientLabel(m.recipient, canSeeContacts)}
                  </p>
                  {m.subject && <p className="mb-1 text-sm font-medium">{m.subject}</p>}
                  <p className="whitespace-pre-wrap text-sm">{m.body}</p>
                </div>
              ))}
            </>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancel
          </Button>
          <Button onClick={send} disabled={sending || blocked}>
            {sending ? wording.busy : wording.button}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
