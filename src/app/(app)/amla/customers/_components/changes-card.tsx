"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { amlaProfileChangeRow } from "@/lib/amla/cdd-view";
import type { AmlaProfileChange } from "@/types/amla-cdd";

/** The last 20 changes to the answers: which fields, who and when. Old and new values stay on the server's record. */
export function ChangesCard({ changes }: { changes: AmlaProfileChange[] }) {
  if (changes.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Changes to the answers</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-1 text-sm">
          {changes.map(amlaProfileChangeRow).map((row) => (
            <li key={row.id}>
              <span className="font-medium">{row.fields}</span>
              <span className="text-muted-foreground">
                {" "}
                by {row.who}, {row.when}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
