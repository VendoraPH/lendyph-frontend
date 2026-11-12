/**
 * The server's 422 `errors` (field key => messages), or null for any other
 * answer.
 */
export function validationErrors(err: unknown): Record<string, string[]> | null {
  const response = (err as { response?: { status?: number; data?: { errors?: Record<string, unknown> } } } | null)
    ?.response;
  if (response?.status !== 422) return null;
  const errors = response.data?.errors;
  if (!errors || typeof errors !== "object") return null;
  return Object.fromEntries(
    Object.entries(errors).map(([key, messages]) => [
      key,
      (Array.isArray(messages) ? messages : []).filter((m): m is string => typeof m === "string" && m.length > 0),
    ]),
  );
}

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
