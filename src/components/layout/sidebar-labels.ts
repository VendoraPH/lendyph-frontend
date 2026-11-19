/** "1 loan application awaiting approval" / "3 loan applications awaiting approval". */
export function countLabel(count: number | undefined, noun: string, state: string): string | undefined {
  if (!count || count <= 0) return undefined;
  return `${count} ${noun}${count === 1 ? "" : "s"} ${state}`;
}

/**
 * The accessible name of a collapsed sidebar link, which shows only an icon:
 * its menu title, then what its badge counts when it has one.
 */
export function collapsedNavLabel(title: string, badgeLabel?: string): string {
  return badgeLabel ? `${title}, ${badgeLabel}` : title;
}

/** "4 new in Loans": a menu link's unviewed notifications, in words. */
export function newLabel(count: number | undefined, title: string): string | undefined {
  if (!count || count <= 0) return undefined;
  return `${count} new in ${title}`;
}

/** The sidebar's collapse or expand button, named for what it does. */
export function sidebarToggleLabel(collapsed: boolean): string {
  return collapsed ? "Expand sidebar" : "Collapse sidebar";
}
