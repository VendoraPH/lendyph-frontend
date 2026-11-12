/** How far back a late run may reach (backend S3, `Cycle::LOOKBACK_DAYS`). */
export const CYCLE_LOOKBACK_DAYS = 92;

export interface CycleOption {
  value: string;
  /** "15th" or "30th (month end)". */
  slot: "15" | "30";
}

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

/** A YYYY-MM-DD string as a UTC day count, so the maths never meets a time zone. */
function dayNumber(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000;
}

/** The last day of a month (1-12). */
function lastDay(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * The cycles a run may take on `today` (Manila, YYYY-MM-DD): every 15th and
 * every month's last day (the "30th") from today back to 92 days ago, newest
 * first. The server checks the same rule and answers 422 in words.
 */
export function cycleDateOptions(today: string): CycleOption[] {
  const [year, month] = today.split("-").map(Number);
  const todayN = dayNumber(today);
  const options: CycleOption[] = [];
  for (let back = 0; back <= 4; back++) {
    const y = month - back > 0 ? year : year - 1;
    const m = ((month - back - 1 + 12) % 12) + 1;
    const candidates: CycleOption[] = [
      { value: iso(y, m, lastDay(y, m)), slot: "30" },
      { value: iso(y, m, 15), slot: "15" },
    ];
    for (const c of candidates) {
      const age = todayN - dayNumber(c.value);
      if (age >= 0 && age <= CYCLE_LOOKBACK_DAYS) options.push(c);
    }
  }
  return options;
}

/** The cycle a run offers first: the latest one on or before today. */
export function latestCycle(today: string): string | null {
  return cycleDateOptions(today)[0]?.value ?? null;
}

export const CYCLE_SLOT_LABELS: Record<CycleOption["slot"], string> = {
  "15": "15th",
  "30": "30th (month end)",
};
