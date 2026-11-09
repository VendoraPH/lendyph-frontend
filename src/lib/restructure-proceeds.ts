// What a loan pays out, as the loan page's card and the loan form show it. A
// restructure pays nothing out: its deductions are collected from the member
// at release (A1's posting), so it shows what is collected and Paid out in
// place of Net Proceeds, as the release dialog does. Every figure is the
// server's; nothing is worked out here.

export interface ProceedsFigure {
  label: string;
  /** As the server sent it; null when it sent none (shown as a dash). */
  amount: string | number | null;
}

type Figure = string | number | null | undefined;

const known = (value: Figure): string | number | null => (value === undefined ? null : value);

export function proceedsFigures(
  isRestructure: boolean,
  figures: {
    totalDeductions: Figure;
    netProceeds: Figure;
    /**
     * A preview's `restructure` block, when it sent one: the release preview's,
     * or `POST /loans/preview`'s when the request named the source loan.
     */
    restructure?: { collected_now?: Figure; paid_out?: Figure } | null;
  },
): ProceedsFigure[] {
  if (!isRestructure) return [{ label: "Net Proceeds", amount: known(figures.netProceeds) }];
  const block = figures.restructure;
  if (block) {
    // The server has answered for this restructure: its two figures, and a
    // dash for one it left out, never one worked out here.
    return [
      { label: "Collected from the member", amount: known(block.collected_now) },
      { label: "Paid out", amount: known(block.paid_out) },
    ];
  }
  // No preview block (a released loan's recorded figures): what was collected
  // is the loan's total deductions, and a restructure pays nothing out, by its
  // posting rule (A1). Until the server has sent a figure, both are dashes.
  const collected = known(figures.totalDeductions);
  return [
    { label: "Collected from the member", amount: collected },
    { label: "Paid out", amount: collected === null ? null : 0 },
  ];
}
