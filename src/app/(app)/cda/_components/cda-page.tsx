"use client";

import { useCallback, type ReactNode } from "react";
import Link from "next/link";
import { DataState } from "@/components/common/data-state";
import { Card, CardContent } from "@/components/ui/card";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { useApiResource } from "@/hooks";
import { cdaService } from "@/services";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import type { Permission } from "@/types";
import type { CdaPeriod } from "@/types/cda";
import { useCdaYearStore } from "../_hooks/use-cda-year";
import { resolveYear } from "../_lib/year";
import { CdaGuard } from "./cda-guard";

export interface CdaPageContext {
  year: number;
  period: CdaPeriod;
  periods: CdaPeriod[];
  reloadPeriods: () => void;
}

interface CdaPageProps {
  title: string;
  description: string;
  /** The restricted view the page needs (mediation, audit, tax), on top of `cda:view` and every branch. */
  restriction?: Permission | null;
  /** Buttons beside the year picker. */
  actions?: (ctx: CdaPageContext | null) => ReactNode;
  /** What to show while no reporting period is open; a link to the dashboard by default. */
  noPeriod?: (reload: () => void) => ReactNode;
  /** Pages that aren't per year (settings) still render without a period. */
  yearless?: boolean;
  children: (ctx: CdaPageContext | null) => ReactNode;
}

function Header({
  title,
  description,
  periods,
  year,
  actions,
}: {
  title: string;
  description: string;
  periods: CdaPeriod[];
  year: number | null;
  actions?: ReactNode;
}) {
  const setPreferred = useCdaYearStore((s) => s.setPreferred);
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {year !== null && periods.length > 0 && (
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            Reporting year
            <NativeSelect
              aria-label="Reporting year"
              value={String(year)}
              onChange={(e) => setPreferred(Number(e.target.value))}
              className="w-28"
            >
              {periods.map((p) => (
                <NativeSelectOption key={p.year} value={String(p.year)}>
                  {p.year}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </label>
        )}
        {actions}
      </div>
    </div>
  );
}

function DefaultNoPeriod() {
  return (
    <Card>
      <CardContent className="py-10 text-center text-sm text-muted-foreground">
        No CDA reporting period is open yet. Open one from the{" "}
        <Link href="/cda" className="font-medium text-primary hover:underline">
          CDA Dashboard
        </Link>
        .
      </CardContent>
    </Card>
  );
}

function PageBody({ title, description, actions, noPeriod, yearless, children }: CdaPageProps) {
  const resource = useApiResource(useCallback(() => cdaService.listPeriods(), []));
  const preferred = useCdaYearStore((s) => s.preferred);
  const periods = resource.data ?? [];
  const year = resolveYear(preferred, periods);
  const period = periods.find((p) => p.year === year) ?? null;
  const ctx: CdaPageContext | null =
    year !== null && period !== null ? { year, period, periods, reloadPeriods: resource.refetch } : null;

  const body = () =>
    ctx === null && !yearless ? (noPeriod ? noPeriod(resource.refetch) : <DefaultNoPeriod />) : children(ctx);

  return (
    <div className="space-y-6">
      <Header title={title} description={description} periods={periods} year={year} actions={actions?.(ctx)} />
      {resource.data !== null && !resource.error ? (
        // A reload (after opening a year or saving an extension) keeps the
        // page in place instead of swapping it for a spinner.
        body()
      ) : (
        <DataState resource={resource} endpoints={[`GET ${API_ENDPOINTS.CDA.PERIODS}`]} summary="The CDA reporting periods">
          {body}
        </DataState>
      )}
    </div>
  );
}

/**
 * The frame of every CDA page: the guard (every branch, `cda:view` and the
 * page's restricted view), then the title and the reporting year picker,
 * whose years are the server's open periods. Nothing is fetched before the
 * guard lets the user in.
 */
export function CdaPage(props: CdaPageProps & { pageName?: string }) {
  return (
    <CdaGuard pageName={props.pageName ?? props.title} restriction={props.restriction ?? null}>
      <PageBody {...props} />
    </CdaGuard>
  );
}
