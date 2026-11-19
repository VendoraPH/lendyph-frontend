"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { amlaApi } from "@/lib/amla/api";
import { amlaDeadlineLines } from "@/lib/amla/settings-view";
import { todayISO } from "@/lib/format";
import { notifyError } from "@/lib/notify";
import type { AmlaDeadlineKind, AmlaDeadlinePreview } from "@/types/amla";

const KINDS: { value: AmlaDeadlineKind; label: string; from: string }[] = [
  { value: "ctr", label: "Covered transaction report (CTR)", from: "Transaction date" },
  { value: "str", label: "Suspicious transaction report (STR)", from: "Date the suspicion was established" },
];

/** When a report would be due: the server counts the working days on the calendar and settings in force. */
export function AmlaDeadlinePreviewCard() {
  const [kind, setKind] = useState<AmlaDeadlineKind>("ctr");
  const [from, setFrom] = useState(todayISO);
  const [preview, setPreview] = useState<AmlaDeadlinePreview | null>(null);
  const [loading, setLoading] = useState(false);
  const fromLabel = KINDS.find((k) => k.value === kind)?.from ?? "From";

  function check() {
    if (from === "" || loading) return;
    setLoading(true);
    amlaApi
      .deadlinePreview(kind, from)
      .then(setPreview)
      .catch((err: unknown) => notifyError(err, "The deadline couldn't be worked out."))
      .then(() => setLoading(false));
  }

  const lines = preview ? amlaDeadlineLines(preview) : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Deadline preview</CardTitle>
        <CardDescription>Working days are counted from the next day, skipping the calendar&apos;s days.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            check();
          }}
        >
          <div className="space-y-1">
            <Label htmlFor="amla-deadline-kind">Report</Label>
            <NativeSelect
              id="amla-deadline-kind"
              value={kind}
              onChange={(e) => {
                setKind(e.target.value as AmlaDeadlineKind);
                setPreview(null);
              }}
            >
              {KINDS.map((k) => (
                <NativeSelectOption key={k.value} value={k.value}>
                  {k.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1">
            <Label htmlFor="amla-deadline-from">{fromLabel}</Label>
            <Input
              id="amla-deadline-from"
              type="date"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setPreview(null);
              }}
            />
          </div>
          <Button type="submit" disabled={from === "" || loading}>
            {loading && <Spinner className="mr-2 h-4 w-4" />}
            Show deadline
          </Button>
        </form>
        {lines && (
          <div aria-live="polite" className="space-y-1 rounded-md border p-3 text-sm">
            <p className="text-base font-semibold">{lines.due}</p>
            <p>{lines.detail}</p>
            {lines.notes.map((note) => (
              <p key={note} className="text-muted-foreground">
                {note}
              </p>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
