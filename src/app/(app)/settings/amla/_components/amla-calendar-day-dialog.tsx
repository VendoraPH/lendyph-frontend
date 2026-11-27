"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useDialogOpening } from "@/hooks/use-dialog-opening";
import { useSubmitGuard } from "@/hooks/use-submit-guard";
import { amlaApi } from "@/lib/amla/api";
import { AMLA_CALENDAR_KIND_OPTIONS, amlaCalendarAddBody, type AmlaCalendarDayForm } from "@/lib/amla/settings-view";
import { notifyError, notifySuccess } from "@/lib/notify";

const EMPTY: AmlaCalendarDayForm = { date: "", kind: "", name: "", source: "", reason: "" };

/** Ask to add a day that isn't a working day, with the proclamation or advisory that announced it. */
export function AmlaCalendarDayDialog({ open, onClose, onAsked }: { open: boolean; onClose: () => void; onAsked: () => void }) {
  const [form, setForm] = useState<AmlaCalendarDayForm>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const { submitting, run } = useSubmitGuard();

  if (useDialogOpening(open, EMPTY)) {
    setForm(EMPTY);
    setError(null);
  }

  const set = (key: keyof AmlaCalendarDayForm) => (value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setError(null);
  };

  function ask() {
    const result = amlaCalendarAddBody(form);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    run(() => amlaApi.ask(result.body))
      ?.then(() => {
        notifySuccess("Change asked for", "The day is added once another AMLA settings holder approves it.");
        onAsked();
      })
      .catch((err: unknown) => notifyError(err, "The change couldn't be asked for."));
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !submitting && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ask to add a calendar day</DialogTitle>
          <DialogDescription>
            A holiday, an AMLC non-reporting day or a reporting facility suspension. Deadlines skip it once another AMLA
            settings holder approves it.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="amla-day-date">Date</Label>
            <Input id="amla-day-date" type="date" value={form.date} disabled={submitting} onChange={(e) => set("date")(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="amla-day-kind">Kind</Label>
            <NativeSelect id="amla-day-kind" className="w-full" value={form.kind} disabled={submitting} onChange={(e) => set("kind")(e.target.value)}>
              <NativeSelectOption value="">Pick a kind</NativeSelectOption>
              {AMLA_CALENDAR_KIND_OPTIONS.map((o) => (
                <NativeSelectOption key={o.value} value={o.value}>
                  {o.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="amla-day-name">Name</Label>
            <Input id="amla-day-name" value={form.name} maxLength={150} disabled={submitting} onChange={(e) => set("name")(e.target.value)} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="amla-day-source">Source</Label>
            <Input
              id="amla-day-source"
              value={form.source}
              maxLength={255}
              disabled={submitting}
              placeholder="The proclamation or AMLC advisory"
              onChange={(e) => set("source")(e.target.value)}
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="amla-day-reason">Reason</Label>
            <Textarea id="amla-day-reason" value={form.reason} maxLength={1000} disabled={submitting} onChange={(e) => set("reason")(e.target.value)} />
          </div>
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={ask} disabled={submitting}>
            {submitting && <Spinner className="mr-2 h-4 w-4" />}
            Ask for approval
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
