"use client";

import { useState } from "react";
import { CalendarClock } from "lucide-react";
import { useDialogOpening, usePermission } from "@/hooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cdaService } from "@/services";
import { formatDate } from "@/lib/format";
import { notifyError, notifySuccess, notifyValidation } from "@/lib/notify";
import { deadlineRequest, showsFor, withDeadline } from "../_lib/screen-gaps";
import type { CdaReport } from "@/types/cda";

/**
 * This report's own deadline (PATCH /cda/reports/{id}/deadline, cda:settings):
 * it wins over the year's extension and the default. A new date needs its
 * reference; the effective deadline and days remaining shown afterwards are
 * the server's answer.
 */
export function ReportDeadline({ report, onChange }: { report: CdaReport; onChange: (r: CdaReport) => void }) {
  const { can } = usePermission();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);

  if (useDialogOpening(open, report.id)) {
    setDate(report.due_override_on ?? "");
    setReference(report.due_override_reference ?? "");
  }

  if (!showsFor("deadline", can)) return null;

  function save(next: string | null) {
    const request = deadlineRequest(next, reference);
    if ("missing" in request) {
      notifyValidation(request.missing);
      return;
    }
    setBusy(true);
    cdaService
      .setReportDeadline(report.id, request.body.override_on, request.body.reference)
      .then((row) => {
        onChange(withDeadline(report, row));
        notifySuccess(next === null ? "Report deadline removed" : "Report deadline saved", `Now due ${formatDate(row.effective_deadline)}.`);
        setOpen(false);
      })
      .catch((err: unknown) => notifyError(err, "Could not save the deadline"))
      .finally(() => setBusy(false));
  }

  return (
    <>
      <Button variant="ghost" size="xs" onClick={() => setOpen(true)}>
        <CalendarClock className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
        Change deadline
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>This report&apos;s own deadline</DialogTitle>
            <DialogDescription>
              Default deadline {formatDate(report.default_due_on)}; now due {formatDate(report.effective_deadline)}. Set one only
              when CDA granted this report its own date. It wins over the year&apos;s extension.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cda-report-deadline">
                New deadline <span className="text-destructive">*</span>
              </Label>
              <Input id="cda-report-deadline" type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={busy} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cda-report-deadline-ref">
                Reference <span className="text-destructive">*</span>
              </Label>
              <Input
                id="cda-report-deadline-ref"
                placeholder="e.g. CDA letter of Apr 2, 2027"
                maxLength={120}
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                disabled={busy}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            {report.due_override_on ? (
              <Button variant="outline" onClick={() => save(null)} disabled={busy}>
                Remove this report&apos;s deadline
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
                Cancel
              </Button>
              <Button onClick={() => save(date)} disabled={busy}>
                {busy ? "Saving…" : "Save deadline"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
