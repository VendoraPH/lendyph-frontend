# Friendly Error & Success Messaging — Design

**Date:** 2026-07-23
**Status:** Approved approach, pending spec review
**Branch:** `feat/friendly-notifications`

## Problem

User-facing feedback across the app is inconsistent and sometimes technical:

- **8+ copy-pasted error parsers** (`showApiError` ×2, `submissionErrorMessage`,
  `extendErrorMessage`, `approvalErrorMessage`, an inline release parser,
  `extractGCashErrorMessage`, plus one-off `err.message` fallbacks) all unwrap the
  same `{ message, errors }` shape slightly differently.
- **Raw technical strings leak to users**: `"Request failed with status code 500"`,
  `"Network Error"`, Laravel validation strings, and even an internal `"Pass force=true"`
  flag reach the UI.
- **Two display channels for the same 422 errors**: inline red `text-destructive` on
  login/register/borrowers vs. toasts everywhere else.
- **~230 `toast.*` calls** with inconsistent tone, casing, and trailing punctuation
  (`"Failed to load pledges"` vs. `"User created successfully"` vs. `"Fee updated"`).

## Decisions (from product owner)

1. **Pop-ups only.** Remove inline red field errors; all feedback is a toast.
2. **Normalize everything** — all ~230 messages get consistent, professional,
   non-technical copy.
3. **Consolidated validation toast**: when a submit fails client validation with
   multiple bad fields, show ONE toast listing the fields to fix (not N stacked
   toasts). Single-field failures read naturally as a one-line toast.

## Architecture

Toast infrastructure already exists and is unchanged: `sonner`, a single
`<Toaster position="top-right" richColors closeButton />` in `src/app/layout.tsx`,
themed via `src/components/ui/sonner.tsx`. We add a thin, well-typed layer above it.

### New module: `src/lib/api-error.ts`

The single source of truth for turning any thrown error into safe, friendly copy.

```ts
// Canonical Laravel-style error body.
interface ApiErrorBody { message?: string; errors?: Record<string, string[]> }

// Extract the first field-validation message, if any.
function firstFieldError(err: unknown): string | null

// Map an unknown error to a user-safe, non-technical message.
// Priority: explicit status-code copy > whitelisted server 422 field message >
//           friendly fallback. NEVER returns a raw Axios/Error.message or an
//           internal backend flag.
function getErrorMessage(err: unknown, fallback?: string): string

// All field messages for a 422 (used by the consolidated validation toast on
// server-side validation failures).
function getFieldErrors(err: unknown): string[]
```

**Status-code → copy map** (professional, non-technical):

| Status / case         | Message |
|-----------------------|---------|
| Offline / no response | "You appear to be offline. Check your connection and try again." |
| 400 / 422 (validation)| the whitelisted server field message, else "Please review the highlighted details and try again." |
| 401                   | "Your session has expired. Please sign in again." |
| 403                   | "You don't have permission to do that." |
| 404                   | "We couldn't find what you were looking for." |
| 409 (conflict)        | "That action conflicts with the current state. Refresh and try again." |
| 413                   | "That file is too large. Please upload a smaller file." |
| 429                   | "Too many attempts. Please wait a moment and try again." |
| 500 / 502 / 503 / 504 | "Something went wrong on our end. Please try again in a moment." |
| unknown               | caller `fallback`, else "Something went wrong. Please try again." |

**Safety rule:** a server `message` is only surfaced when the status is a
validation status (422/400) OR the string passes a "looks human" guard
(not matching `/status code|network error|axios|force=true|SQLSTATE|exception/i`).
Otherwise the status-code copy or fallback is used. This is what stops raw
technical strings from leaking.

### New module: `src/lib/notify.ts`

Consistent wrappers so every toast has the same tone. Thin — delegates to `sonner`.

```ts
notifyError(err: unknown, fallback?: string): void        // getErrorMessage → toast.error
notifySuccess(message: string, description?: string): void// toast.success
notifyInfo(message: string, description?: string): void
notifyWarning(message: string, description?: string): void

// Consolidated client-validation toast. `fields` is the list of human field
// labels that failed. 1 field → one-line; many → titled list.
notifyValidation(fields: string[]): void
```

Copy style rules enforced by convention (documented at top of `notify.ts`):
- Sentence case, no "successfully" filler, no trailing period on short labels.
- Success = what happened, plainly: "Member created", "Payment posted",
  "Loan approved", "Logo updated".
- Never interpolate raw error objects.

### Form validation flow (replacing inline red text)

Client validators keep computing which fields are invalid, but instead of writing
to an `errors` state that renders `text-destructive`, they collect the failing
field **labels** and call `notifyValidation(labels)`. The `border-destructive`
ring on inputs and the `<p className="text-destructive">` elements are removed.
Required-field asterisks (`<span className="text-destructive">*</span>`) STAY —
they are affordances, not errors.

For the multi-step register wizard, validation runs per "Next" click and the
consolidated toast lists that step's failing fields.

## Migration plan

1. **Foundation** — add `api-error.ts`, `notify.ts`, unit-test `getErrorMessage`
   against each status/leak case.
2. **Replace duplicated parsers** — delete `showApiError` ×2, `submissionErrorMessage`,
   `extendErrorMessage`, `approvalErrorMessage`, the inline release parser, and route
   `gcash-errors.ts` through the shared helper (keep its domain-specific 409/tier copy
   as overrides passed in).
3. **Remove inline field errors** — login, register (+ step components), borrowers
   new/edit, and the other `errors`-state forms → `notifyValidation` + `notifyError`.
4. **Normalize all `toast.*` copy** — sweep ~50 files, apply the copy style rules,
   kill raw-string fallbacks (`err.message`, raw `data.message` on non-422).

## Testing

- Unit tests for `getErrorMessage` / `getFieldErrors`: 401/403/404/413/422/429/500,
  offline (no `response`), raw-`err.message` leak guard, internal-flag guard.
- `npx tsc --noEmit` and `npm run build` green.
- Manual: trigger a validation failure (register), a 500, and an offline error;
  confirm only friendly copy shows and no red inline text remains.

## Out of scope

- Changing toast position/theme/animation (already fine).
- Backend message wording (we defend against it, we don't change it).
- Adding new success toasts where none exist today (normalize existing only).
