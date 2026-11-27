/**
 * A member file's Member Portal sharing state from the staff document list.
 * lendyph-backend sends `portal_shared_at` (a Manila time, or null) to staff
 * who can share (member_portal:manage and borrowers:view); a backend that
 * predates it leaves the field out, and the state is unknown.
 */
export function sharedFromList(doc: object): boolean | undefined {
  if (!("portal_shared_at" in doc)) return undefined;
  return (doc as { portal_shared_at: unknown }).portal_shared_at != null;
}
