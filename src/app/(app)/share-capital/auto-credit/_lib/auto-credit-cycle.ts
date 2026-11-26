// The cycle a share capital auto-credit run is for (finish run round 8): a
// month's 15th or its 30th, as the savings auto-credit picks its cycle. The
// server decides which cycles a run may take (the current one, or a missed
// one it allows; never a future one), names them, and works out the preview.
// Dependency-free, so it runs under `tsx --test`.

export interface CycleChoice {
  /** YYYY-MM-DD, as the server sent it. */
  value: string;
  /** The server's words ("November 30"); the current cycle is marked. */
  label: string;
}

function dateAndLabel(value: unknown): { date: string; label: string } | null {
  if (typeof value !== "object" || value === null) return null;
  const { date, label } = value as Record<string, unknown>;
  return typeof date === "string" && date !== "" && typeof label === "string" && label !== "" ? { date, label } : null;
}

/** "Run for": the server's `cycle_options`, the current one first and marked. */
export function cycleOptions(status: Record<string, unknown>): CycleChoice[] {
  const raw = Array.isArray(status.cycle_options) ? status.cycle_options : [];
  return raw
    .map(dateAndLabel)
    .filter((option): option is { date: string; label: string } => option !== null)
    .map((option, index) => ({ value: option.date, label: index === 0 ? `${option.label} (current)` : option.label }));
}

/** The cycle the preview is for (`cycle_date`, `cycle_label`), or null when the server sent none. */
export function previewCycle(status: Record<string, unknown>): { date: string; label: string } | null {
  return dateAndLabel({ date: status.cycle_date, label: status.cycle_label });
}

/**
 * The toast after a run: the cycle the server says it ran (else the one
 * sent), the server's total as already formatted, and how many it skipped,
 * whose reasons the page lists.
 */
export function runCompletedMessage(
  result: { cycle_label?: unknown; skipped_count?: number },
  sentLabel: string,
  total: string,
  members: number,
): string {
  const cycle = typeof result.cycle_label === "string" && result.cycle_label !== "" ? result.cycle_label : sentLabel;
  const skipped = result.skipped_count ?? 0;
  return (
    `Auto-credit for ${cycle} completed: ${total} credited to ${members} member${members === 1 ? "" : "s"}` +
    (skipped > 0 ? `; ${skipped} skipped (see the reasons on the page).` : ".")
  );
}
