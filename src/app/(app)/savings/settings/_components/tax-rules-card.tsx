"use client";

import { useState } from "react";
import { PermissionButton } from "@/components/common/permission-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useSubmitGuard } from "@/hooks/use-submit-guard";
import { formatDate, formatRate, todayISO } from "@/lib/format";
import { notifyError, notifySuccess, notifyValidation } from "@/lib/notify";
import { savingsService } from "@/services";
import type { SavingsHolderType, SavingsSettings } from "@/types";
import { FormField } from "../../_components/field";
import { OptionSelect } from "../../_components/option-select";
import { HOLDER_TYPE_LABELS, labelOf } from "../../_lib/savings-rules";
import { readTaxRule } from "../_lib/settings-form";

interface TaxRulesCardProps {
  settings: SavingsSettings;
  onAdded: () => void;
}

const HOLDER_OPTIONS = (Object.keys(HOLDER_TYPE_LABELS) as SavingsHolderType[]).map((h) => ({
  value: h,
  label: HOLDER_TYPE_LABELS[h],
}));

/** Tax withheld on deposit interest, by holder type. Append-only: a new rule takes effect on its date. */
export function TaxRulesCard({ settings, onAdded }: TaxRulesCardProps) {
  const today = todayISO();
  const [holder, setHolder] = useState<SavingsHolderType>("member");
  const [rate, setRate] = useState("");
  const [from, setFrom] = useState(today);
  const { submitting, run } = useSubmitGuard();

  function add() {
    const { input, problems } = readTaxRule(holder, rate, from, today);
    if (problems.length) return notifyValidation(problems);
    run(() => savingsService.addTaxRule(input))
      ?.then(() => {
        notifySuccess("Tax rule added", `${labelOf(HOLDER_TYPE_LABELS, holder)}: ${formatRate(input.rate)}% from ${formatDate(from)}`);
        setRate("");
        onAdded();
      })
      .catch((err: unknown) => notifyError(err, "Couldn't add the tax rule."));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Tax on deposit interest</CardTitle>
        <CardDescription>
          Today: members {formatRate(settings.current_tax_rates.member)}%, walk-ins{" "}
          {formatRate(settings.current_tax_rates.non_member)}%. Rules are never edited; add a new one to change a rate.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid items-end gap-3 sm:grid-cols-4">
          <FormField id="tx-holder" label="Applies to">
            <OptionSelect
              id="tx-holder"
              value={holder}
              onChange={(v) => setHolder(v as SavingsHolderType)}
              options={HOLDER_OPTIONS}
            />
          </FormField>
          <FormField id="tx-rate" label="Rate (%)">
            <Input id="tx-rate" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="20" />
          </FormField>
          <FormField id="tx-from" label="Effective from">
            <Input id="tx-from" type="date" min={today} value={from} onChange={(e) => setFrom(e.target.value)} />
          </FormField>
          <PermissionButton permission="savings:settings" onClick={add} disabled={submitting}>
            {submitting ? "Adding…" : "Add rule"}
          </PermissionButton>
        </div>
        <div className="max-h-72 overflow-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Effective from</TableHead>
                <TableHead>Applies to</TableHead>
                <TableHead className="text-right">Rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {settings.tax_rules.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    No tax rules yet.
                  </TableCell>
                </TableRow>
              ) : (
                settings.tax_rules.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{formatDate(r.effective_from)}</TableCell>
                    <TableCell>{labelOf(HOLDER_TYPE_LABELS, r.holder_type)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatRate(r.rate)}%</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
