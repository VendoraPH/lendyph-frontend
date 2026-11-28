"use client";

import { useCallback, useMemo, useState } from "react";
import { useApiResource } from "@/hooks";
import { emptyDrain } from "@/lib/paginate";
import { todayISO } from "@/lib/format";
import { cicService } from "@/services";
import type { CicCapture, CicSourceFilter } from "@/types/cic";

/** A list's source: built live as of a date, or read from one complete capture. */
export interface CicSourceValue {
  captureId: number | null;
  referenceDate: string;
}

/**
 * The source the record and issue lists read from, and the complete captures
 * to choose among. Live is today's picture by default.
 */
export function useCicSource(initialCaptureId: number | null = null) {
  const [value, setValue] = useState<CicSourceValue>({ captureId: initialCaptureId, referenceDate: todayISO() });
  const fetcher = useCallback(
    () => cicService.listAllCaptures().catch(() => emptyDrain<CicCapture>()),
    [],
  );
  const captures = useApiResource(fetcher);
  const complete = useMemo(() => (captures.data?.rows ?? []).filter((c) => c.status === "complete"), [captures.data]);
  const source: CicSourceFilter = useMemo(
    () => (value.captureId !== null ? { capture_id: value.captureId } : { reference_date: value.referenceDate }),
    [value],
  );
  return { value, setValue, source, captures: complete };
}
