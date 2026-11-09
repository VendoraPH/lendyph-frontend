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
    /** The release preview's `restructure` block, when it sent one. */
    restructure?: { collected_now?: Figure; paid_out?: Figure } | null;
  },
): ProceedsFigure[] {
  if (!isRestructure) return [{ label: "Net Proceeds", amount: known(figures.netProceeds) }];
  return [
    {
      label: "Collected from the member",
      amount: known(figures.restructure?.collected_now ?? figures.totalDeductions),
    },
    // A restructure pays nothing out, by its posting rule (A1); the release
    // preview's own `paid_out` is shown when it was sent.
    { label: "Paid out", amount: known(figures.restructure?.paid_out ?? 0) },
  ];
}
