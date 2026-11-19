"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useDialogOpening } from "@/hooks/use-dialog-opening";
import { useSubmitGuard } from "@/hooks/use-submit-guard";
import type { AmlaSubjectRef } from "@/lib/amla/cdd-access";
import { amlaCddApi } from "@/lib/amla/cdd-api";
import { AMLA_REVIEW_KIND_OPTIONS, AMLA_REVIEW_OUTCOME_OPTIONS, amlaReviewBody, amlaReviewLines } from "@/lib/amla/cdd-view";
import { formatDate } from "@/lib/format";
import { notifyError, notifySuccess } from "@/lib/notify";
import type { AmlaCddView } from "@/types/amla-cdd";
import { CddFormDialog } from "./cdd-form-dialog";

/** The next review the server set (on the 1/2/3-year cycle, "to verify"), and each review's outcome. */
export function ReviewsCard({ view, subject, onRecorded }: { view: AmlaCddView; subject: AmlaSubjectRef; onRecorded: () => void }) {
  const [recording, setRecording] = useState(false);
  const lines = amlaReviewLines(view.profile);

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <CardTitle className="text-base">Reviews</CardTitle>
          <CardDescription>
            {lines.next}. {lines.last}.
          </CardDescription>
        </div>
        {view.profile.exists && (
          <Button size="sm" variant="outline" onClick={() => setRecording(true)}>
            Record a review
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {lines.edd && <p className="rounded-md border bg-muted/40 p-3">{lines.edd}</p>}
        {!view.profile.exists && <p className="text-muted-foreground">Start the due diligence profile before recording a review.</p>}
        {view.reviews.length === 0 ? (
          view.profile.exists && <p className="text-muted-foreground">No reviews recorded yet.</p>
        ) : (
          <ul className="space-y-2">
            {view.reviews.map((review) => (
              <li key={review.id} className="rounded-md border p-2">
                <div className="font-medium">
                  {review.kind_words}, {formatDate(review.reviewed_on)}: {review.outcome_words}
                </div>
                <div className="text-muted-foreground">
                  By {review.reviewed_by?.name ?? "the system"}. Next review {formatDate(review.next_review_on)}.
                </div>
                {review.notes && <div className="whitespace-pre-line">{review.notes}</div>}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      {view.profile.exists && (
        <ReviewDialog
          open={recording}
          subject={subject}
          onClose={() => setRecording(false)}
          onRecorded={() => {
            setRecording(false);
            onRecorded();
          }}
        />
      )}
    </Card>
  );
}

const EMPTY = { kind: "", outcome: "", notes: "" };

function ReviewDialog({ open, subject, onClose, onRecorded }: { open: boolean; subject: AmlaSubjectRef; onClose: () => void; onRecorded: () => void }) {
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const { submitting, run } = useSubmitGuard();

  if (useDialogOpening(open, subject)) {
    setForm(EMPTY);
    setError(null);
  }

  const set = (key: keyof typeof EMPTY) => (value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setError(null);
  };

  function submit() {
    const result = amlaReviewBody(form);
    if ("error" in result) return setError(result.error);
    run(() => amlaCddApi.review(subject, result.body))
      ?.then(() => {
        notifySuccess("Review recorded");
        onRecorded();
      })
      .catch((err: unknown) => notifyError(err, "The review couldn't be recorded."));
  }

  return (
    <CddFormDialog
      open={open}
      title="Record a review"
      description="The server sets the next review from the current risk level. An enhanced due diligence review completes EDD and needs notes."
      submitLabel="Record"
      submitting={submitting}
      error={error}
      onClose={onClose}
      onSubmit={submit}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="cdd-review-kind">Kind</Label>
          <NativeSelect id="cdd-review-kind" className="w-full" value={form.kind} disabled={submitting} onChange={(e) => set("kind")(e.target.value)}>
            <NativeSelectOption value="">Pick a kind</NativeSelectOption>
            {AMLA_REVIEW_KIND_OPTIONS.map((o) => (
              <NativeSelectOption key={o.value} value={o.value}>
                {o.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1">
          <Label htmlFor="cdd-review-outcome">Outcome</Label>
          <NativeSelect id="cdd-review-outcome" className="w-full" value={form.outcome} disabled={submitting} onChange={(e) => set("outcome")(e.target.value)}>
            <NativeSelectOption value="">Pick an outcome</NativeSelectOption>
            {AMLA_REVIEW_OUTCOME_OPTIONS.map((o) => (
              <NativeSelectOption key={o.value} value={o.value}>
                {o.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="cdd-review-notes">
          Notes{form.kind !== "edd" && <span className="text-muted-foreground"> (optional)</span>}
        </Label>
        <Textarea id="cdd-review-notes" value={form.notes} maxLength={2000} disabled={submitting} onChange={(e) => set("notes")(e.target.value)} />
      </div>
    </CddFormDialog>
  );
}
