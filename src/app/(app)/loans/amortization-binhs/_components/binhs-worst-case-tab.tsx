"use client";

import { useMemo } from "react";
import { buildWorstCaseSchedule, type BinhsInput } from "@/lib/binhs";
import { BinhsScheduleTable } from "./binhs-schedule-table";

export function BinhsWorstCaseTab({ input }: { input: BinhsInput }) {
  const rows = useMemo(() => buildWorstCaseSchedule(input), [input]);
  return <BinhsScheduleTable rows={rows} />;
}
