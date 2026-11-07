"use client";

import { useCallback } from "react";
import { RouteGuard } from "@/components/common";
import { DataState } from "@/components/common/data-state";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApiResource } from "@/hooks";
import { cdaService } from "@/services";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import { formatCurrency, formatDate } from "@/lib/format";
import { formatValue } from "@/lib/report-format";
import { cn } from "@/lib/utils";
import type { CdaLoanClassification } from "@/types/cda";
import { CdaPageHeader } from "../_components/cda-page-header";
import { useCdaYear } from "../_hooks/use-cda-year";

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "danger" | "success" }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle
          className={cn(
            "text-xl tabular-nums",
            tone === "danger" && "text-red-600 dark:text-red-400",
            tone === "success" && "text-emerald-600 dark:text-emerald-400",
          )}
        >
          {value}
        </CardTitle>
      </CardHeader>
    </Card>
  );
}

function Classification({ data }: { data: CdaLoanClassification }) {
  const gap = data.provision_gap;
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Loan portfolio" value={formatCurrency(data.total_balance)} />
        <Kpi label="Required allowance" value={formatCurrency(data.required_allowance)} />
        <Kpi label="Allowance on the books" value={formatCurrency(data.existing_allowance)} />
        <Kpi
          label={gap > 0 ? "Under-provisioned by" : "Provision gap"}
          value={formatCurrency(Math.abs(gap))}
          tone={gap > 0 ? "danger" : "success"}
        />
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Classification as of {formatDate(data.as_of)}</CardTitle>
          <CardDescription>Read-only: computed from loan aging. Fix a figure at its source loan.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Classification</TableHead>
                <TableHead>Days past due</TableHead>
                <TableHead className="text-right">Loans</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
                <TableHead className="text-right">Required rate</TableHead>
                <TableHead className="text-right">Required allowance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.map((r) => (
                <TableRow key={r.classification}>
                  <TableCell className="font-medium">{r.classification}</TableCell>
                  <TableCell>{r.dpd_range}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.loan_count}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(r.outstanding_balance)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatValue(r.required_rate, "percent")}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(r.required_allowance)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={3}>Total</TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(data.total_balance)}</TableCell>
                <TableCell />
                <TableCell className="text-right tabular-nums">{formatCurrency(data.required_allowance)}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function LoanClassification() {
  const year = useCdaYear();
  const resource = useApiResource(useCallback(() => cdaService.getLoanClassification(year), [year]));
  return (
    <div className="space-y-6">
      <CdaPageHeader
        title="Loan Classification & Provisioning"
        description="Loans by aging class with the allowance CDA requires, against the allowance booked."
      />
      <DataState
        resource={resource}
        endpoints={[`GET ${API_ENDPOINTS.CDA.LOAN_CLASSIFICATION(year)}`]}
        summary={`Loan classification and the provisioning gap at FY ${year} year-end`}
        isEmpty={(d) => d.rows.length === 0}
        emptyMessage="No loans outstanding at year-end."
      >
        {(data) => <Classification data={data} />}
      </DataState>
    </div>
  );
}

export default function Page() {
  return (
    <RouteGuard permission="cda:view" pageName="Loan Classification">
      <LoanClassification />
    </RouteGuard>
  );
}
