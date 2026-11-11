/**
 * The idle timeout the member sees coming (portal design §1).
 *
 * The server ends a session after `idle_minutes` without a request and then
 * answers 401 `session_idle`. The browser can't move that line, only warn
 * before it: in the last minute (or the last half, for a very short window)
 * the member is asked whether to stay signed in, and at the line itself the
 * tab signs out with the same words the server would use.
 */

export type IdlePhase = "active" | "warning" | "expired";

const MINUTE = 60_000;

/** How long before the idle line the warning shows. */
export function warningLeadMs(idleMinutes: number): number {
  const windowMs = idleMinutes * MINUTE;
  return windowMs > 2 * MINUTE ? MINUTE : windowMs / 2;
}

export function idlePhase(lastActivityAt: number, idleMinutes: number, now: number): IdlePhase {
  if (!(idleMinutes > 0) || lastActivityAt <= 0) return "active";
  const endsAt = lastActivityAt + idleMinutes * MINUTE;
  if (now >= endsAt) return "expired";
  if (now >= endsAt - warningLeadMs(idleMinutes)) return "warning";
  return "active";
}
