import { cn } from "@/lib/utils";

/**
 * "Penalty: N month(s) late" under a penalty figure (`penaltyMonthsNote()`).
 * Renders nothing when there is no note. Import it by path.
 */
export function PenaltyMonthsNote({ note, className }: { note: string | null; className?: string }) {
  if (note === null) return null;
  return <p className={cn("text-[10px] font-normal text-destructive", className)}>{note}</p>;
}
