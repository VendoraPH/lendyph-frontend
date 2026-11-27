"use client";

import { useState } from "react";
import { todayISO } from "@/lib/format";
import { defaultCicReferenceDate } from "@/lib/cic/records";

/** The screen's File Reference Date, starting at the month just closed. */
export function useReferenceDate(initial?: string | null) {
  return useState(() => initial || defaultCicReferenceDate(todayISO()));
}
