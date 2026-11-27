"use client";

import { useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { ToneBadge } from "@/components/loan-origination/badges";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Textarea } from "@/components/ui/textarea";
import { useDialogOpening } from "@/hooks/use-dialog-opening";
import { formatDateTime } from "@/lib/format";
import { notifyError, notifySuccess } from "@/lib/notify";
import { loanOriginationService } from "@/services";
import type { NoticeType, OriginationNotice } from "@/types/loan-origination";
import { NOTICE_TYPES, noticePayload, type NoticeForm } from "../../_lib/notices";

const typeLabel = (type: NoticeType | "") => NOTICE_TYPES.find((t) => t.type === type)?.label ?? "Notice";

/**
 * "Publish a new version": the form, then a confirmation, since a published
 * version can never be edited or removed. A refusal (a version the type
 * already has, say) comes back in the server's words and returns to the form.
 */
export function PublishNoticeDialog({
  type,
  open,
  onOpenChange,
  onDone,
}: {
  /** The type to start on; "" lets staff choose. */
  type: NoticeType | "";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const [form, setForm] = useState<NoticeForm>({ type, version: "", title: "", body: "", final: false });
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  if (useDialogOpening(open, type)) {
    setForm({ type, version: "", title: "", body: "", final: false });
    setConfirming(false);
  }
  const set = (patch: Partial<NoticeForm>) => setForm((f) => ({ ...f, ...patch }));
  const { payload, problem } = noticePayload(form);

  const publish = () => {
    setBusy(true);
    loanOriginationService
      .publishNotice(payload)
      .then((notice) => {
        notifySuccess(`${typeLabel(notice.type)} version ${notice.version} published`);
        onDone();
        onOpenChange(false);
      })
      .catch((err) => {
        notifyError(err, "Could not publish the notice");
        setConfirming(false);
      })
      .then(() => setBusy(false));
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{confirming ? "Publish this version?" : "Publish a new version"}</DialogTitle>
          <DialogDescription>
            {confirming
              ? `${typeLabel(form.type)} version ${payload.version}${form.final ? ", as the final text" : ", as a draft"}.`
              : "It becomes the current text applicants read and accept."}
          </DialogDescription>
        </DialogHeader>
        {confirming ? (
          <p className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            Published text can&apos;t be edited or removed. To change it later, publish a new version.
          </p>
        ) : (
          <div className="space-y-3 overflow-y-auto">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="notice-type">Notice</Label>
                <NativeSelect
                  id="notice-type"
                  className="w-full"
                  value={form.type}
                  onChange={(e) => set({ type: e.target.value as NoticeType | "" })}
                >
                  <NativeSelectOption value="" disabled>
                    Choose a notice
                  </NativeSelectOption>
                  {NOTICE_TYPES.map((t) => (
                    <NativeSelectOption key={t.type} value={t.type}>
                      {t.label}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="notice-version">Version</Label>
                <Input
                  id="notice-version"
                  maxLength={20}
                  placeholder="2026.1"
                  value={form.version}
                  onChange={(e) => set({ version: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">Letters, digits, dots and dashes. Each version is published once.</p>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="notice-title">Title (optional)</Label>
                <Input id="notice-title" maxLength={150} value={form.title} onChange={(e) => set({ title: e.target.value })} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="notice-body">Text</Label>
                <Textarea id="notice-body" rows={10} maxLength={50000} value={form.body} onChange={(e) => set({ body: e.target.value })} />
              </div>
            </div>
            <label className="flex items-start gap-2 text-sm">
              <Checkbox className="mt-0.5" checked={form.final} onCheckedChange={(final) => set({ final })} />
              <span>
                Final text
                <span className="block text-xs text-muted-foreground">
                  The owner&apos;s approved wording. Left unticked, it is a draft, and applicants see it marked as one.
                </span>
              </span>
            </label>
            {problem && <p className="text-xs text-muted-foreground">{problem}</p>}
          </div>
        )}
        <DialogFooter>
          {confirming ? (
            <>
              <Button variant="outline" onClick={() => setConfirming(false)} disabled={busy}>
                Back
              </Button>
              <Button onClick={publish} disabled={busy}>
                {busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                Publish
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={() => setConfirming(true)} disabled={problem !== null}>
                Review and publish
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** One published version, read-only: it can't be edited. */
export function NoticeTextDialog({ notice, onClose }: { notice: OriginationNotice | null; onClose: () => void }) {
  return (
    <Dialog open={notice !== null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent size="lg">
        {notice && (
          <>
            <DialogHeader>
              <DialogTitle>{notice.title || typeLabel(notice.type)}</DialogTitle>
              <DialogDescription>
                {typeLabel(notice.type)} version {notice.version}
                {notice.published_at && <> · published {formatDateTime(notice.published_at)}</>}
                {notice.published_by && <> by {notice.published_by.name}</>}
              </DialogDescription>
            </DialogHeader>
            <div>
              <ToneBadge tone={notice.final ? "success" : "warning"}>{notice.final ? "Final" : "Draft"}</ToneBadge>
            </div>
            <div className="overflow-y-auto rounded-lg border bg-muted/30 p-3 text-sm whitespace-pre-wrap">{notice.body}</div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
