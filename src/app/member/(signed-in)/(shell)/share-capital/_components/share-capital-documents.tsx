"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DownloadButton } from "@/components/portal/download-button";
import { SectionCard } from "@/components/portal/section-card";
import { todayISO } from "@/lib/format";
import { portalService } from "@/lib/portal/portal-api";

/**
 * The share capital statement for a range and the certificate as of a day,
 * as PDFs. The server checks the dates (no later than today, at most 5 years)
 * and says so in words.
 */
export function ShareCapitalDocuments() {
  const today = todayISO();
  const [from, setFrom] = useState(`${today.slice(0, 4)}-01-01`);
  const [to, setTo] = useState(today);
  const [asOf, setAsOf] = useState(today);

  return (
    <SectionCard title="Statement and certificate">
      <div className="grid gap-6 md:grid-cols-2">
        <fieldset className="space-y-3">
          <legend className="text-sm font-medium">Statement</legend>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="sc-from">From</Label>
              <Input id="sc-from" type="date" max={today} value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sc-to">To</Label>
              <Input id="sc-to" type="date" max={today} value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
          <DownloadButton
            download={() => portalService.shareCapitalStatement(from, to)}
            fileName={`share-capital-statement-${from}-${to}.pdf`}
            disabled={!from || !to}
          >
            Statement (PDF)
          </DownloadButton>
        </fieldset>
        <fieldset className="space-y-3">
          <legend className="text-sm font-medium">Certificate</legend>
          <div className="space-y-1.5">
            <Label htmlFor="sc-as-of">As of</Label>
            <Input id="sc-as-of" type="date" max={today} value={asOf} onChange={(e) => setAsOf(e.target.value)} />
          </div>
          <DownloadButton
            download={() => portalService.shareCapitalCertificate(asOf)}
            fileName={`share-capital-certificate-${asOf}.pdf`}
            disabled={!asOf}
          >
            Certificate (PDF)
          </DownloadButton>
        </fieldset>
      </div>
    </SectionCard>
  );
}
