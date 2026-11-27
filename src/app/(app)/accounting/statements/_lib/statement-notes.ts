import type { Permission } from "@/types";
import type { StatementNotesPesos } from "@/types/cda";
import { formatDate } from "@/lib/format";

/** The PESOS line of the notes, in words: the server's figures as sent, "—" where it sent none. */
export interface PesosNote {
  /** False when the year has no CDA reporting period, so there is nothing to quote. */
  inUse: boolean;
  score: string;
  rating: string;
  /** "Finalized {date}", "Provisional", or "—". */
  status: string;
  /** Shown while the PESOS rules aren't verified against the official CDA tool. */
  toVerify: string | null;
  disclosure: string | null;
}

export function pesosNote(pesos: StatementNotesPesos): PesosNote {
  const status =
    pesos.source === "finalized"
      ? pesos.finalized_at
        ? `Finalized ${formatDate(pesos.finalized_at)}`
        : "Finalized"
      : pesos.provisional
        ? "Provisional"
        : "—";
  const inUse = pesos.source !== null;
  return {
    inUse,
    score: pesos.score ?? "—",
    rating: pesos.rating ?? "—",
    status,
    toVerify: inUse && !pesos.verified ? "To verify against the official CDA tool" : null,
    disclosure: inUse && !pesos.verified ? pesos.disclosure : null,
  };
}

/**
 * The Notes tab quotes the whole cooperative's CDA figures, so it needs
 * `accounting:view` plus `branches:view_all`, and CDA switched on
 * (NEXT_PUBLIC_ENABLE_CDA).
 */
export function canSeeStatementNotes(can: (p: Permission) => boolean, cdaEnabled: boolean): boolean {
  return cdaEnabled && can("accounting:view") && can("branches:view_all");
}
