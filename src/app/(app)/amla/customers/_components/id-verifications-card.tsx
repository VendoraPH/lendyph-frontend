"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { AmlaSubjectRef } from "@/lib/amla/cdd-access";
import { formatDate, formatDateTime } from "@/lib/format";
import type { AmlaCddView } from "@/types/amla-cdd";
import { IdVerificationDialog } from "./id-verification-dialog";

/** ID checks, newest first, by type and last four only. A check points at an ID already on record; there is no upload here. */
export function IdVerificationsCard({ view, subject, onRecorded }: { view: AmlaCddView; subject: AmlaSubjectRef; onRecorded: () => void }) {
  const [recording, setRecording] = useState(false);
  const walkInWithoutId = subject.type === "walk_in" && !view.subject.has_valid_id;

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <CardTitle className="text-base">ID verification</CardTitle>
          <CardDescription>{view.id_state_words}.</CardDescription>
        </div>
        <Button size="sm" variant="outline" disabled={walkInWithoutId} onClick={() => setRecording(true)}>
          Record an ID check
        </Button>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {walkInWithoutId && <p className="text-muted-foreground">This walk-in has no ID on record, so there is nothing to verify.</p>}
        {view.id_verifications.length === 0 ? (
          <p className="text-muted-foreground">No ID checks recorded yet.</p>
        ) : (
          <ul className="space-y-2">
            {view.id_verifications.map((check) => (
              <li key={check.id} className="rounded-md border p-2">
                <div className="font-medium">
                  {check.id_type_words}
                  {check.id_number_masked ? ` ${check.id_number_masked}` : ""}: {check.result_words}
                </div>
                <div className="text-muted-foreground">
                  {check.method_words}
                  {check.expires_on ? `. Expires ${formatDate(check.expires_on)}` : ""}. By {check.verified_by?.name ?? "the system"},{" "}
                  {formatDateTime(check.verified_at)}.
                </div>
                {check.notes && <div className="whitespace-pre-line">{check.notes}</div>}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      {!walkInWithoutId && (
        <IdVerificationDialog
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
