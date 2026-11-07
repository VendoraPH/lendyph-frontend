import { create } from "zustand";
import { persist } from "zustand/middleware";
import { todayISO } from "@/lib/format";
import { defaultReportingYear } from "../_lib/deadline";

interface CdaYearState {
  year: number;
  setYear: (year: number) => void;
}

/**
 * The reporting year every CDA screen reads. Persisted so moving between
 * screens (and reloading) keeps the year; defaults to last year, which is the
 * one being filed.
 */
export const useCdaYearStore = create<CdaYearState>()(
  persist(
    (set) => ({
      year: defaultReportingYear(todayISO()),
      setYear: (year) => set({ year }),
    }),
    { name: "lendy-cda-year" },
  ),
);

export function useCdaYear(): number {
  return useCdaYearStore((s) => s.year);
}
