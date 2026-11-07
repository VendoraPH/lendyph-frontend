"use client";

import { useCallback, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { useApiResource } from "@/hooks/use-api-resource";
import { todayISO } from "@/lib/format";
import { notifyValidation } from "@/lib/notify";
import {
  periodProblem,
  presetRange,
  STATEMENT_KINDS,
  STATEMENT_PRESETS,
  statementFilename,
  type StatementPreset,
} from "@/lib/portal/finance";
import { saveFile } from "@/lib/portal/save-file";
import { portalService } from "@/services/portal.service";
import type { PortalFeatures, StatementKind } from "@/types/portal";
import { notifyDownloadError } from "../../_components/download-button";
import { usePortalConfig } from "../../_components/portal-config";
import { PortalPageHeader } from "../../_components/portal-shell";
import { ServiceOff } from "../../_components/service-off";

/** The member service each statement kind depends on. */
const KIND_FEATURE: Partial<Record<StatementKind, keyof PortalFeatures>> = {
  loan: "loans",
  savings: "savings",
  share_capital: "share_capital",
};

export default function MemberStatementsPage() {
  const { config } = usePortalConfig();
  return (
    <>
      <PortalPageHeader
        title="Statements"
        description="Download a PDF statement of your accounts for any period, for your records or a loan elsewhere."
      />
      {config.features.statements ? <StatementForm features={config.features} /> : <ServiceOff service="Statements" />}
    </>
  );
}

function StatementForm({ features }: { features: PortalFeatures }) {
  const kinds = (Object.keys(STATEMENT_KINDS) as StatementKind[]).filter((k) => {
    const feature = KIND_FEATURE[k];
    return !feature || features[feature] !== false;
  });
  const [kind, setKind] = useState<StatementKind>("consolidated");
  const [accountId, setAccountId] = useState("");
  const [preset, setPreset] = useState<StatementPreset | "custom">("last_3_months");
  const initial = presetRange("last_3_months", new Date());
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [busy, setBusy] = useState(false);

  const fetchLoans = useCallback(() => portalService.loans(), []);
  const loans = useApiResource(fetchLoans, kind === "loan");
  const fetchSavings = useCallback(() => portalService.savings(), []);
  const savings = useApiResource(fetchSavings, kind === "savings");
  const accounts =
    kind === "loan"
      ? (loans.data ?? []).map((l) => ({ id: l.id, label: `${l.loan_number} · ${l.product_name}` }))
      : kind === "savings"
        ? (savings.data ?? []).map((s) => ({ id: s.id, label: `${s.account_number} · ${s.product_name}` }))
        : [];
  const needsAccount = kind === "loan" || kind === "savings";

  const choosePreset = (value: StatementPreset | "custom") => {
    setPreset(value);
    if (value === "custom") return;
    const range = presetRange(value, new Date());
    setFrom(range.from);
    setTo(range.to);
  };

  const download = (e: React.FormEvent) => {
    e.preventDefault();
    const problems: string[] = [];
    if (needsAccount && !accountId) problems.push(kind === "loan" ? "Choose a loan" : "Choose a savings account");
    const period = periodProblem(from, to, todayISO());
    if (period) problems.push(period);
    if (problems.length) return notifyValidation(problems);

    const account = accounts.find((a) => String(a.id) === accountId);
    setBusy(true);
    portalService
      .statement({ kind, account_id: needsAccount ? Number(accountId) : undefined, from, to })
      .then((blob) => saveFile(blob, statementFilename(kind, from, to, account?.label.split(" · ")[0])))
      .catch((err) => notifyDownloadError(err, "Statements are not available online yet."))
      .finally(() => setBusy(false));
  };

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle className="text-base">Request a statement</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={download}>
          <div className="space-y-1.5">
            <Label htmlFor="kind">Statement for</Label>
            <NativeSelect
              id="kind"
              className="w-full"
              value={kind}
              onChange={(e) => {
                setKind(e.target.value as StatementKind);
                setAccountId("");
              }}
            >
              {kinds.map((k) => (
                <NativeSelectOption key={k} value={k}>
                  {STATEMENT_KINDS[k]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          {needsAccount && (
            <div className="space-y-1.5">
              <Label htmlFor="account">{kind === "loan" ? "Loan" : "Savings account"}</Label>
              <NativeSelect
                id="account"
                className="w-full"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
              >
                <NativeSelectOption value="">
                  {(kind === "loan" ? loans : savings).loading ? "Loading…" : "Choose one"}
                </NativeSelectOption>
                {accounts.map((a) => (
                  <NativeSelectOption key={a.id} value={String(a.id)}>
                    {a.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="period">Period</Label>
            <NativeSelect
              id="period"
              className="w-full"
              value={preset}
              onChange={(e) => choosePreset(e.target.value as StatementPreset | "custom")}
            >
              {(Object.keys(STATEMENT_PRESETS) as StatementPreset[]).map((p) => (
                <NativeSelectOption key={p} value={p}>
                  {STATEMENT_PRESETS[p]}
                </NativeSelectOption>
              ))}
              <NativeSelectOption value="custom">Choose dates</NativeSelectOption>
            </NativeSelect>
          </div>
          {preset === "custom" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="from">From</Label>
                <Input id="from" type="date" max={to || todayISO()} value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="to">To</Label>
                <Input id="to" type="date" min={from} max={todayISO()} value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
            </div>
          )}
          <Button type="submit" disabled={busy}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            Download PDF
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
