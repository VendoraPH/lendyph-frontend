"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useBranches, useDialogOpening } from "@/hooks";
import { notifyError, notifySuccess, notifyWarning } from "@/lib/notify";
import {
  announcementBody,
  announcementInput,
  announcementProblem,
  AUDIENCE_LABELS,
  MEMBER_TYPES,
  parseMemberNumbers,
} from "@/lib/portal/engagement";
import { branchPicker } from "@/lib/user-branches";
import { portalAdminService } from "@/services/portal-admin.service";
import { useAuthStore } from "@/store";
import type { AnnouncementAudience, AnnouncementInput, StaffAnnouncement } from "@/types/portal";

const toggle = <T,>(list: T[], value: T, on: boolean) =>
  on ? [...new Set([...list, value])] : list.filter((v) => v !== value);

export function AnnouncementDialog({
  open,
  announcement,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  /** null writes a new one. */
  announcement: StaffAnnouncement | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const { branches } = useBranches();
  // Without `branches:view_all` only the caller's own branches are offered.
  const caller = useAuthStore((s) => s.user);
  const viewAll = useAuthStore((s) => s.hasPermission("branches:view_all"));
  const picker = branchPicker(branches, caller, viewAll);
  const [form, setForm] = useState<AnnouncementInput>(() => announcementInput(null));
  const [numbers, setNumbers] = useState("");
  const [busy, setBusy] = useState(false);

  if (useDialogOpening(open, announcement)) {
    const input = announcementInput(announcement);
    setForm(input);
    setNumbers(input.member_numbers.join("\n"));
  }

  const set = <K extends keyof AnnouncementInput>(key: K, value: AnnouncementInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const save = (publish: boolean) => {
    const input = { ...form, publish, member_numbers: parseMemberNumbers(numbers) };
    const problem = announcementProblem(input);
    if (problem) return notifyWarning(problem);
    const body = announcementBody(input);
    setBusy(true);
    const request = announcement
      ? portalAdminService.updateAnnouncement(announcement.id, body)
      : portalAdminService.createAnnouncement(body);
    request
      .then(() => {
        notifySuccess(publish ? (body.publish_at ? "Announcement scheduled" : "Announcement published") : "Draft saved");
        onOpenChange(false);
        onSaved();
      })
      .catch((err) => notifyError(err, "The announcement could not be saved."))
      .finally(() => setBusy(false));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{announcement ? "Edit announcement" : "New announcement"}</DialogTitle>
          <DialogDescription>Plain text. Members see it in their portal and are notified when it goes out.</DialogDescription>
        </DialogHeader>
        <form
          id="announcement-form"
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            save(true);
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="announcement-title">Title</Label>
            <Input id="announcement-title" maxLength={150} value={form.title} onChange={(e) => set("title", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="announcement-body">Message</Label>
            <Textarea id="announcement-body" rows={5} value={form.body} onChange={(e) => set("body", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="announcement-audience">Who sees it</Label>
            <NativeSelect
              id="announcement-audience"
              value={form.audience}
              onChange={(e) => set("audience", e.target.value as AnnouncementAudience)}
            >
              {(Object.keys(AUDIENCE_LABELS) as AnnouncementAudience[]).map((a) => (
                <NativeSelectOption key={a} value={a}>
                  {AUDIENCE_LABELS[a]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          {form.audience === "branch" && (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Branches</legend>
              {picker.branches.length === 0 && <p className="text-sm text-muted-foreground">No branches to choose from.</p>}
              {picker.branches.map((b) => (
                <label key={b.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={form.branch_ids.includes(b.id)}
                    onCheckedChange={(on) => set("branch_ids", toggle(form.branch_ids, b.id, Boolean(on)))}
                  />
                  {b.name}
                </label>
              ))}
            </fieldset>
          )}
          {form.audience === "member_type" && (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Member types</legend>
              {MEMBER_TYPES.map((t) => (
                <label key={t.value} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={form.member_types.includes(t.value)}
                    onCheckedChange={(on) => set("member_types", toggle(form.member_types, t.value, Boolean(on)))}
                  />
                  {t.label}
                </label>
              ))}
            </fieldset>
          )}
          {form.audience === "members" && (
            <div className="space-y-1.5">
              <Label htmlFor="announcement-members">Member numbers</Label>
              <Textarea
                id="announcement-members"
                rows={3}
                placeholder="One per line, or separated by commas"
                value={numbers}
                onChange={(e) => setNumbers(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">{parseMemberNumbers(numbers).length} members</p>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="announcement-publish">Publish at (optional)</Label>
              <Input
                id="announcement-publish"
                type="datetime-local"
                value={form.publish_at ?? ""}
                onChange={(e) => set("publish_at", e.target.value || null)}
              />
              <p className="text-xs text-muted-foreground">Blank publishes it now.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="announcement-expires">Show until (optional)</Label>
              <Input
                id="announcement-expires"
                type="datetime-local"
                value={form.expires_at ?? ""}
                min={form.publish_at ?? undefined}
                onChange={(e) => set("expires_at", e.target.value || null)}
              />
            </div>
          </div>
          <label className="flex items-center justify-between gap-3 text-sm">
            Pin to the top of members&apos; announcements
            <Switch checked={form.pinned} onCheckedChange={(on) => set("pinned", on)} />
          </label>
        </form>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button variant="secondary" onClick={() => save(false)} disabled={busy}>
            Save draft
          </Button>
          <Button type="submit" form="announcement-form" disabled={busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {form.publish_at ? "Schedule" : "Publish"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
