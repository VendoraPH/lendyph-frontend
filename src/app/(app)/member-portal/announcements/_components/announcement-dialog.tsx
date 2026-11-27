"use client";

import { useState } from "react";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useBranches, useDialogOpening, usePermission } from "@/hooks";
import { useSubmitGuard } from "@/hooks/use-submit-guard";
import { notifySuccess } from "@/lib/notify";
import { branchPicker } from "@/lib/user-branches";
import { portalAdminService } from "@/services/portal-admin.service";
import { useAuthStore } from "@/store";
import type { PortalAnnouncement, PortalAnnouncementAudience, PortalMemberType } from "@/types/portal-admin";
import { FormField } from "../../../savings/_components/field";
import { OptionSelect } from "../../../savings/_components/option-select";
import { AUDIENCE_LABELS, MEMBER_TYPE_LABELS, optionsOf } from "../../_lib/labels";
import { audiencesFor, draftBody, draftOf, draftProblems, type AnnouncementDraft } from "../../_lib/announcement-form";
import { notifyPortalError } from "../../_lib/notify-portal-error";

const toggle = <T,>(list: T[], value: T, on: boolean) => (on ? [...new Set([...list, value])] : list.filter((v) => v !== value));
const MEMBER_TYPES = optionsOf(MEMBER_TYPE_LABELS);

interface AnnouncementDialogProps {
  open: boolean;
  /** null writes a new one. */
  announcement: PortalAnnouncement | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

/**
 * Write or edit an announcement to members (plain text, 5,000 characters).
 * Saving keeps a draft until it is published; "Save and publish" publishes it
 * now, or at its start time. Company-wide audiences need branches:view_all;
 * branch staff announce to their own branches only. Adapted from #514 by
 * Augustin (selected-member audiences are v2).
 */
export function AnnouncementDialog({ open, announcement, onOpenChange, onSaved }: AnnouncementDialogProps) {
  const { can } = usePermission();
  const viewAll = can("branches:view_all");
  const { branches } = useBranches(open);
  const caller = useAuthStore((s) => s.user);
  const picker = branchPicker(branches, caller, viewAll);
  const [draft, setDraft] = useState<AnnouncementDraft>(() => draftOf(null, viewAll));
  const [submitted, setSubmitted] = useState(false);
  // A new draft saved by a "Save and publish" whose publish failed: the next try edits it instead of adding another.
  const [createdId, setCreatedId] = useState<number | null>(null);
  const { submitting, run } = useSubmitGuard();
  if (useDialogOpening(open, announcement)) {
    setDraft(draftOf(announcement, viewAll));
    setSubmitted(false);
    setCreatedId(null);
  }

  const set = <K extends keyof AnnouncementDraft>(key: K, value: AnnouncementDraft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const problems = draftProblems(draft, viewAll);
  const isDraft = !announcement || announcement.status === "draft";
  const audienceOptions = audiencesFor(viewAll).map((a) => ({ value: a, label: AUDIENCE_LABELS[a] }));

  function save(publish: boolean) {
    setSubmitted(true);
    if (problems.length > 0) return;
    const body = draftBody(draft);
    const existingId = announcement?.id ?? createdId;
    run(async () => {
      const saved =
        existingId !== null
          ? await portalAdminService.updateAnnouncement(existingId, body)
          : await portalAdminService.createAnnouncement(body);
      if (existingId === null) setCreatedId(saved.id);
      return publish ? portalAdminService.publishAnnouncement(saved.id) : saved;
    })
      ?.then((saved) => {
        notifySuccess(
          saved.status === "published"
            ? saved.live
              ? "Announcement published"
              : "Announcement scheduled"
            : isDraft
              ? "Draft saved"
              : "Announcement saved",
        );
        onOpenChange(false);
        onSaved();
      })
      .catch((err: unknown) => {
        notifyPortalError(err, "The announcement couldn't be saved.");
        // A new draft that saved but didn't publish is in the list as a draft.
        onSaved();
      });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{announcement ? "Edit announcement" : "New announcement"}</DialogTitle>
          <DialogDescription>
            Plain text. Members see it in their portal while it runs; nothing is sent by text or email.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <FormField id="an-title" label="Title">
            <Input id="an-title" maxLength={150} value={draft.title} onChange={(e) => set("title", e.target.value)} />
          </FormField>
          <FormField id="an-body" label="Message" hint={`${draft.body.length} of 5,000 characters`}>
            <Textarea id="an-body" rows={6} maxLength={5000} value={draft.body} onChange={(e) => set("body", e.target.value)} />
          </FormField>
          <FormField id="an-audience" label="Who sees it">
            <OptionSelect
              id="an-audience"
              value={draft.audience}
              onChange={(v) => set("audience", v as PortalAnnouncementAudience)}
              options={audienceOptions}
            />
          </FormField>
          {draft.audience === "branch" && (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Branches</legend>
              {picker.branches.length === 0 && <p className="text-sm text-muted-foreground">No branches to choose from.</p>}
              {picker.branches.map((b) => (
                <label key={b.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={draft.branch_ids.includes(b.id)}
                    onCheckedChange={(on) => set("branch_ids", toggle(draft.branch_ids, b.id, on === true))}
                  />
                  {b.name}
                </label>
              ))}
            </fieldset>
          )}
          {draft.audience === "member_type" && (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Member types</legend>
              {MEMBER_TYPES.map((t) => (
                <label key={t.value} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={draft.member_types.includes(t.value)}
                    onCheckedChange={(on) => set("member_types", toggle<PortalMemberType>(draft.member_types, t.value, on === true))}
                  />
                  {t.label}
                </label>
              ))}
            </fieldset>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField id="an-start" label="Starts (optional)" hint="Philippine time. Blank: as soon as it's published.">
              <Input id="an-start" type="datetime-local" value={draft.publish_at} onChange={(e) => set("publish_at", e.target.value)} />
            </FormField>
            <FormField id="an-end" label="Ends (optional)" hint="Philippine time. Blank: until withdrawn.">
              <Input
                id="an-end"
                type="datetime-local"
                value={draft.expires_at}
                min={draft.publish_at || undefined}
                onChange={(e) => set("expires_at", e.target.value)}
              />
            </FormField>
          </div>
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="an-pinned" className="font-normal">
              Pin to the top of members&apos; announcements
            </Label>
            <Switch id="an-pinned" checked={draft.pinned} onCheckedChange={(on) => set("pinned", on === true)} />
          </div>
          {submitted && problems.length > 0 && (
            <ul className="space-y-1 text-xs text-destructive" role="alert">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button variant={isDraft ? "secondary" : "default"} onClick={() => save(false)} disabled={submitting}>
            {isDraft ? "Save draft" : "Save"}
          </Button>
          {isDraft && (
            <Button onClick={() => save(true)} disabled={submitting}>
              {submitting ? "Saving…" : "Save and publish"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
