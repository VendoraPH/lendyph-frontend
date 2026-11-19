/**
 * A collapsible section's toggle name: "Collapse Loan Portfolio" while open,
 * "Expand Loan Portfolio" while closed. Undefined for a title that isn't
 * plain text, so the trigger keeps its own content as its name.
 */
export function collapsibleToggleLabel(title: unknown, open: boolean): string | undefined {
  if (typeof title !== "string" || title.trim() === "") return undefined;
  return `${open ? "Collapse" : "Expand"} ${title}`;
}
