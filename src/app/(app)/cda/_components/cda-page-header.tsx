"use client";

import type { ReactNode } from "react";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { todayISO } from "@/lib/format";
import { defaultReportingYear } from "../_lib/deadline";
import { useCdaYearStore } from "../_hooks/use-cda-year";

interface CdaPageHeaderProps {
  title: string;
  description: string;
  actions?: ReactNode;
  /** Registers that are not per year (officers, settings) hide the selector. */
  showYear?: boolean;
}

/** The six most recent fiscal years, newest first, plus a stored older one. */
function yearOptions(selected: number): number[] {
  const latest = defaultReportingYear(todayISO());
  const years = Array.from({ length: 6 }, (_, i) => latest - i);
  return years.includes(selected) ? years : [...years, selected];
}

export function CdaPageHeader({ title, description, actions, showYear = true }: CdaPageHeaderProps) {
  const year = useCdaYearStore((s) => s.year);
  const setYear = useCdaYearStore((s) => s.setYear);

  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {showYear && (
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            Reporting year
            <NativeSelect
              aria-label="Reporting year"
              value={String(year)}
              onChange={(e) => setYear(Number(e.target.value))}
              className="w-28"
            >
              {yearOptions(year).map((y) => (
                <NativeSelectOption key={y} value={String(y)}>
                  FY {y}
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
