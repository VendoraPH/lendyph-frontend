/**
 * Avatar initials, from a name the API may not actually have sent.
 *
 * This existed four times over — in `borrowers/_components/utils.ts`,
 * `borrower-header.tsx`, `dashboard/page.tsx`, `audit-trail/page.tsx` and
 * `settings/profile/page.tsx` — and not one of the copies survived a missing
 * name. That is not a hypothetical: `Borrower.full_name` is typed
 * non-optional, so the compiler is no help at all when the backend omits it
 * (a trimmed list payload, a soft-deleted relation, a `user` that came back
 * `null` on an audit row). The name arrives `undefined`, `.split` throws, and
 * the whole table unmounts behind an error boundary because one row had no
 * name. The dashboard copy went one worse and threw on `""` as well, reaching
 * into `parts[0][0]` after `.filter(Boolean)` had emptied the array.
 *
 * So the guard lives here, once, and every avatar in the app inherits it.
 *
 * Two deliberate choices, documented because the copies disagreed:
 *
 *  - **First letters of the first two words.** Three of the four copies did
 *    this; only the dashboard's took first-and-LAST. First-two matches the
 *    borrowers module, which is where most avatars in this app are rendered,
 *    so adopting it here leaves those screens pixel-identical.
 *  - **A single word yields its first TWO letters** ("Madonna" -> "MA"), not
 *    one. Only the dashboard copy did this; it is the better of the two,
 *    because a lone letter in a round chip reads as a rendering fault rather
 *    than as a name.
 *
 * @param name  Any value the API might hand over. Not typed `string` on
 *              purpose: a `string` parameter is exactly the assurance that
 *              was already false at every call site.
 * @param fallback What to show when there is no name to initialise. "?" by
 *              default, which is what the audit trail was already passing in
 *              by hand (`log.user?.full_name ?? "?"`). Pass `""` for an empty
 *              chip instead.
 */
export function getInitials(
  name: string | null | undefined,
  fallback = "?"
): string {
  // `typeof` rather than a truthiness check: this is the boundary where an
  // untrusted payload meets code that assumed a string, so a number or an
  // object has to land on the fallback too, not on `.split is not a function`.
  const words = typeof name === "string" ? name.split(/\s+/).filter(Boolean) : [];

  // Covers undefined, null, "", "   " and any non-string in one branch.
  if (words.length === 0) return fallback;

  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();

  return (words[0][0] + words[1][0]).toUpperCase();
}
