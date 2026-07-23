// Pure formatter for the consolidated client-validation toast. Kept dependency-
// free (no sonner import) so it is unit-testable via tsx and reusable anywhere.

/**
 * Build a single friendly message listing the fields a user must fix, so a
 * failed submit shows one pop-up instead of one toast per field.
 *
 * - []                       → "Please complete the required fields."
 * - ["Email"]                → "Please enter a valid Email."
 * - ["First name", "Email"]  → "Please complete: First name and Email."
 * - 3+                       → "Please complete: A, B, and C."
 */
export function formatValidationMessage(fields: string[]): string {
  const clean = fields.map((f) => f.trim()).filter(Boolean);
  if (clean.length === 0) return "Please complete the required fields.";
  if (clean.length === 1) return `Please enter a valid ${clean[0]}.`;
  if (clean.length === 2) return `Please complete: ${clean[0]} and ${clean[1]}.`;
  const last = clean[clean.length - 1];
  return `Please complete: ${clean.slice(0, -1).join(", ")}, and ${last}.`;
}
