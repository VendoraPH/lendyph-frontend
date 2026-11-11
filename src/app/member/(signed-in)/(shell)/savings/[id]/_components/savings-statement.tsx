"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DownloadButton } from "@/components/portal/download-button";
import { SectionCard } from "@/components/portal/section-card";
import { todayISO } from "@/lib/format";
import { portalService } from "@/lib/portal/portal-api";

/** The account's statement as a PDF. Leave the dates empty for everything up to today; the server checks the range. */
export function SavingsStatement({ accountId, accountNumber }: { accountId: number; accountNumber: string }) {
  const today = todayISO();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  return (
    <SectionCard title="Statement">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="sv-from">From</Label>
          <Input id="sv-from" type="date" max={today} value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sv-to">To</Label>
          <Input id="sv-to" type="date" max={today} value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <DownloadButton download={() => portalService.savingsStatement(accountId, from, to)} fileName={`savings-statement-${accountNumber}.pdf`}>
          Statement (PDF)
        </DownloadButton>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Leave the dates empty for the statement up to today (at most 5 years).</p>
    </SectionCard>
  );
}
