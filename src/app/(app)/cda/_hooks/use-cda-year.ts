import { create } from "zustand";
import { persist } from "zustand/middleware";

interface CdaYearState {
  /** The reporting year last picked, or null before one is. */
  preferred: number | null;
  setPreferred: (year: number) => void;
}

/**
 * The reporting year the CDA screens open on (carried over from #510 by
 * Augustin). Persisted so moving between screens, and reloading, keeps it.
 * Which years exist is the server's (`GET /cda/periods`); `resolveYear` falls
 * back to the newest one when the stored year isn't open.
 */
export const useCdaYearStore = create<CdaYearState>()(
  persist(
    (set) => ({
      preferred: null,
      setPreferred: (year) => set({ preferred: year }),
    }),
    { name: "lendy-cda-year" },
  ),
);
