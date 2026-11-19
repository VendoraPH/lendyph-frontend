"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { AmlaSubjectRef } from "@/lib/amla/cdd-access";
import { formatDateTime } from "@/lib/format";
import type { AmlaCddProfile } from "@/types/amla-cdd";
import { ProfileEditDialog } from "./profile-edit-dialog";

/** The KYC answers on the AMLA profile, in the server's words. They live only on the AMLA profile, never on the member form. */
export function ProfileAnswersCard({ profile, subject, onSaved }: { profile: AmlaCddProfile; subject: AmlaSubjectRef; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const answer = (value: string | number | null | undefined) => (value === null || value === undefined || value === "" ? "Not answered" : String(value));
  const source =
    profile.source_of_funds === "other" && profile.source_of_funds_other
      ? `Other: ${profile.source_of_funds_other}`
      : answer(profile.source_of_funds_words);
  const rows: [string, string][] = [
    ["Nationality", answer(profile.nationality)],
    ["Occupation or business", answer(profile.occupation)],
    ["Source of funds", source],
    ["Purpose of the relationship", answer(profile.purpose)],
    ["Expected monthly amount", answer(profile.expected_monthly_amount_words)],
    ["Expected transactions a month", answer(profile.expected_monthly_count)],
    ["Politically exposed person", answer(profile.pep_status_words)],
    ["PEP details", answer(profile.pep_details)],
    ["Adverse information to verify", profile.adverse_info === null ? "Not answered" : profile.adverse_info ? "Yes" : "No"],
    ["Adverse information note", answer(profile.adverse_info_note)],
  ];

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <CardTitle className="text-base">Due diligence answers</CardTitle>
          <CardDescription>
            {profile.exists
              ? profile.updated_at
                ? `Last changed ${formatDateTime(profile.updated_at)}.`
                : "Started."
              : "Not started. The first save starts the profile."}
          </CardDescription>
        </div>
        <Button size="sm" onClick={() => setEditing(true)}>
          {profile.exists ? "Edit answers" : "Start profile"}
        </Button>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[minmax(0,14rem)_1fr]">
          {rows.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="break-words whitespace-pre-line">{value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
      <ProfileEditDialog
        open={editing}
        profile={profile}
        subject={subject}
        onClose={() => setEditing(false)}
        onSaved={() => {
          setEditing(false);
          onSaved();
        }}
      />
    </Card>
  );
}
