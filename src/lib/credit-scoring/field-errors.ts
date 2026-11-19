import { validationErrors } from "@/lib/api-error";

// Moved to the shared API error helpers; re-exported for existing imports.
export { validationErrors };

/**
 * The server's 422 messages for one field and its items (`categories` and
 * `categories.0.weight_percent`), so a screen can show them where the field is.
 */
export function fieldErrorsFor(err: unknown, field: string): string[] {
  const errors = validationErrors(err);
  if (!errors) return [];
  return Object.entries(errors)
    .filter(([key]) => key === field || key.startsWith(`${field}.`))
    .flatMap(([, messages]) => messages);
}
