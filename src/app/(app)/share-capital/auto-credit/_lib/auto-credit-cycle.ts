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

/** A branch of the caller's members on auto-credit, and its run for the cycle, if any. */
export interface CycleBranch {
  name: string;
  /** When its run for the cycle was made, or null when it has none. */
  processedAt: string | null;
  done: boolean;
}

/**
 * The server's `cycle_branches` (round 9): one row per branch of the caller's
 * members on auto-credit, in the server's order (by name). An older API that
 * sends none reads as no branches; unreadable rows are left out.
 */
export function cycleBranches(status: Record<string, unknown>): CycleBranch[] {
  const raw = Array.isArray(status.cycle_branches) ? status.cycle_branches : [];
  return raw.flatMap((row: unknown): CycleBranch[] => {
    if (typeof row !== "object" || row === null) return [];
    const { branch_name: name, run_id: runId, processed_at: processedAt } = row as Record<string, unknown>;
    if (typeof name !== "string" || name === "") return [];
    return [{
      name,
      processedAt: typeof processedAt === "string" && processedAt !== "" ? processedAt : null,
      done: typeof runId === "number",
    }];
  });
}

/**
 * The status card for the chosen cycle (finish run round 8): its own run
 * (`cycle_run`), never another cycle's last run. Since round 9 `cycle_run` is
 * only a run that covered every branch of the caller's members on
 * auto-credit, so a cycle run for some branches only reads as partly done,
 * naming the branches done and not yet. `formatDay` reads the run's time as a
 * date in the app's time zone.
 */
export function cycleRunState(
  status: Record<string, unknown>,
  cycleLabel: string,
  formatDay: (value: string) => string,
): { done: boolean; text: string } {
  const run = status.cycle_run;
  if (typeof run === "object" && run !== null) {
    const { processed_at: processedAt, status: runStatus } = run as Record<string, unknown>;
    if (runStatus === "completed" && typeof processedAt === "string" && processedAt !== "") {
      return { done: true, text: `Completed on ${formatDay(processedAt)}` };
    }
  }
  const branches = cycleBranches(status);
  const done = branches.filter((branch) => branch.done);
  const notYet = branches.filter((branch) => !branch.done);
  if (done.length > 0 && notYet.length === 0) {
    // Every branch has its own run for the cycle, though no single run
    // covered them all: the cycle is done, on the day of its latest run.
    const latest = done.map((branch) => branch.processedAt).filter((at): at is string => at !== null).sort().at(-1);
    return { done: true, text: latest ? `Completed on ${formatDay(latest)}` : `Completed for ${cycleLabel}` };
  }
  if (done.length > 0) {
    const names = (rows: CycleBranch[]) => rows.map((branch) => branch.name).join(", ");
    return { done: false, text: `Partly done for ${cycleLabel}: ${names(done)} done; not yet: ${names(notYet)}` };
  }
  return { done: false, text: `Not run yet for ${cycleLabel}` };
}

/** "0 members", "1 member", "12 members". */
export function membersCount(count: number): string {
  return `${count} member${count === 1 ? "" : "s"}`;
}
