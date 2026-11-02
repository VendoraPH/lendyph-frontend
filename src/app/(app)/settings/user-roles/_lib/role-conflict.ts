import { getErrorMessage } from "@/lib/api-error";

const CONFLICT_FALLBACK = "This role was changed or deleted by another request. Reload and try again.";

/**
 * The message for a role save or delete that lost to another request.
 *
 * `PUT /roles/{id}` and `DELETE /roles/{id}` answer 409 when the role was
 * deleted while the request waited, having written nothing. The server's own
 * sentence says so; a 409 without a readable one gets the same wording here
 * rather than the generic "conflicts with the current state". Any other error
 * returns null and keeps its own handling.
 */
export function roleConflictMessage(err: unknown): string | null {
  if (!err || typeof err !== "object" || !("response" in err)) return null;
  const status = (err as { response?: { status?: number } }).response?.status;
  if (status !== 409) return null;

  // getErrorMessage answers a 409 with no readable message with its generic
  // conflict copy; that copy is what's swapped for the role's own wording.
  const generic = getErrorMessage({ response: { status: 409, data: {} } });
  const message = getErrorMessage(err, CONFLICT_FALLBACK);
  return message === generic ? CONFLICT_FALLBACK : message;
}
