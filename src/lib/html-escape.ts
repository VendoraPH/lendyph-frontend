const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/**
 * Escape anything that came off the wire before it reaches generated HTML.
 *
 * The one control standing between a borrower-supplied name and script
 * execution in the print window. Borrowers self-register publicly and
 * `first_name` restricts no characters, so a member registered as
 * `<script>…</script>` is a payload the API will happily store and hand back.
 * There is no CSP behind this — nothing else catches it.
 *
 * INVARIANT — every interpolation site must sit inside a double-quoted
 * attribute or a text node. That is what makes this five-character set
 * sufficient: an unquoted or single-quoted attribute can be escaped with a
 * space or a backtick, and `<script>`/`<style>` bodies and `href="javascript:"`
 * are different grammars this does not cover. Interpolate only where the
 * invariant holds.
 *
 * `&` is in the set and is replaced too, so an already-escaped `&amp;` comes
 * back as `&amp;amp;` — correct, since the input is text, not markup.
 */
export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).replace(/[&<>"']/g, (char) => HTML_ESCAPES[char] ?? char);
}
