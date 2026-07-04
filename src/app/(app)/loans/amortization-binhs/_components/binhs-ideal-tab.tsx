"use client";

import { useMemo } from "react";
import { buildIdealSchedule, type BinhsInput } from "@/lib/binhs";
import { BinhsScheduleTable } from "./binhs-schedule-table";

export function BinhsIdealTab({ input }: { input: BinhsInput }) {
  const rows = useMemo(() => buildIdealSchedule(input), [input]);
  return <BinhsScheduleTable rows={rows} />;
}
