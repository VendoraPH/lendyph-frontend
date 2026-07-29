# Friendly Error & Success Messaging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace 8 duplicated error parsers and all inline red field errors with one shared helper + pop-up toasts, and normalize every user-facing message to professional, non-technical copy.

**Architecture:** A single dependency-free `src/lib/api-error.ts` maps any thrown error to safe friendly copy (status-code map + leak guard). A thin `src/lib/notify.ts` wraps `sonner` for consistent tone and a consolidated validation toast. Every page routes through these; inline `text-destructive` error text and `border-destructive` rings are removed (required-field `*` asterisks stay).

**Tech Stack:** Next.js (App Router), TypeScript, `sonner` toasts, `node:test` via `tsx` for unit tests.

## Global Constraints

- **No new runtime dependencies.** Unit tests use `node:test` + `node:assert/strict` run via `npx tsx --test`.
- **`api-error.ts` must stay pure** — no React, no `@/` alias imports, structural error detection (check `err.response.status`), NOT `instanceof AxiosError`. Test files import it by relative path (`./api-error`).
- **Leak guard is mandatory:** a server `message` is surfaced only for 400/422, or when it passes `looksHuman()` (fails `/status code|network error|axios|force=true|sqlstate|exception|undefined|null|econn|timeout of/i`). Otherwise use status-code copy or the caller fallback.
- **Copy style:** sentence case; no "successfully" filler; no trailing period on short success labels; success states what happened ("Member created", "Payment posted"); never interpolate a raw error object.
- **Keep** required-field asterisks `<span className="text-destructive">*</span>`. **Remove** only error text `<p className="text-destructive">{error}</p>` and `border-destructive` conditionals on inputs.
- Verify each task with `npm run typecheck` (`tsc --noEmit`) and, at the end, `npm run build`.

---

### Task 1: Core error helper `api-error.ts` (TDD)

**Files:**
- Create: `src/lib/api-error.ts`
- Test: `src/lib/api-error.test.ts`
- Modify: `package.json` (add `test:unit` script)

**Interfaces:**
- Produces:
  - `interface ApiErrorBody { message?: string; errors?: Record<string, string[]> }`
  - `getErrorMessage(err: unknown, fallback?: string): string`
  - `getFieldErrors(err: unknown): string[]`
  - `firstFieldError(err: unknown): string | null`

- [ ] **Step 1: Add the test:unit script**

In `package.json` `scripts`, add:
```json
"test:unit": "tsx --test src/**/*.test.ts"
```

- [ ] **Step 2: Write the failing test** — `src/lib/api-error.test.ts`

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { getErrorMessage, getFieldErrors, firstFieldError } from "./api-error";

const httpErr = (status: number, data?: unknown) => ({ response: { status, data } });

test("422 surfaces the first field message", () => {
  const err = httpErr(422, { message: "Validation failed", errors: { email: ["The email has already been taken."] } });
  assert.equal(getErrorMessage(err), "The email has already been taken.");
});

test("422 with no field errors uses generic validation copy", () => {
  assert.equal(getErrorMessage(httpErr(422, {})), "Please review the highlighted details and try again.");
});

test("401 maps to session-expired copy", () => {
  assert.equal(getErrorMessage(httpErr(401)), "Your session has expired. Please sign in again.");
});

test("403 maps to permission copy", () => {
  assert.equal(getErrorMessage(httpErr(403)), "You don't have permission to do that.");
});

test("404 maps to not-found copy", () => {
  assert.equal(getErrorMessage(httpErr(404)), "We couldn't find what you were looking for.");
});

test("413 maps to file-too-large copy", () => {
  assert.equal(getErrorMessage(httpErr(413)), "That file is too large. Please upload a smaller file.");
});

test("429 maps to rate-limit copy", () => {
  assert.equal(getErrorMessage(httpErr(429)), "Too many attempts. Please wait a moment and try again.");
});

test("500 maps to server copy, ignoring any raw backend message", () => {
  assert.equal(getErrorMessage(httpErr(500, { message: "SQLSTATE[23000]: Integrity constraint" })), "Something went wrong on our end. Please try again in a moment.");
});

test("no response (offline) maps to connection copy", () => {
  assert.equal(getErrorMessage({ message: "Network Error" }), "You appear to be offline. Check your connection and try again.");
});

test("raw Axios status-code string never leaks even on unknown status", () => {
  assert.equal(getErrorMessage(httpErr(418, { message: "Request failed with status code 418" }), "Could not complete that."), "Could not complete that.");
});

test("internal force=true flag never leaks", () => {
  assert.equal(getErrorMessage(httpErr(409, { message: "Pass force=true to override" }), "That conflicts."), "That conflicts.");
});

test("a human 400 message is surfaced", () => {
  assert.equal(getErrorMessage(httpErr(400, { message: "Amount exceeds the available balance." })), "Amount exceeds the available balance.");
});

test("getFieldErrors returns all messages flattened", () => {
  const err = httpErr(422, { errors: { a: ["A required"], b: ["B invalid", "B too long"] } });
  assert.deepEqual(getFieldErrors(err), ["A required", "B invalid", "B too long"]);
});

test("firstFieldError returns null when none", () => {
  assert.equal(firstFieldError(httpErr(500, {})), null);
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx tsx --test src/lib/api-error.test.ts`
Expected: FAIL — cannot find module `./api-error`.

- [ ] **Step 4: Implement `src/lib/api-error.ts`**

```ts
// Single source of truth for turning any thrown value into safe, friendly,
// non-technical copy. Pure and dependency-free so it is unit-testable via tsx.

export interface ApiErrorBody {
  message?: string;
  errors?: Record<string, string[]>;
}

interface HttpErrorShape {
  response?: { status?: number; data?: ApiErrorBody };
}

// Structural detection — avoids `instanceof AxiosError` (fragile across bundles).
function asHttpError(err: unknown): HttpErrorShape | null {
  if (err && typeof err === "object" && "response" in err) return err as HttpErrorShape;
  return null;
}

function bodyOf(err: unknown): ApiErrorBody | undefined {
  return asHttpError(err)?.response?.data;
}

export function getFieldErrors(err: unknown): string[] {
  const errors = bodyOf(err)?.errors;
  if (!errors) return [];
  return Object.values(errors).flat().filter((m): m is string => typeof m === "string" && m.length > 0);
}

export function firstFieldError(err: unknown): string | null {
  return getFieldErrors(err)[0] ?? null;
}

// Reject strings that are clearly technical / internal rather than user copy.
function looksHuman(msg: string | undefined): msg is string {
  if (!msg || typeof msg !== "string") return false;
  return !/status code|network error|axios|force=true|sqlstate|exception|undefined|null|econn|timeout of|\bstack\b/i.test(msg);
}

const STATUS_COPY: Record<number, string> = {
  401: "Your session has expired. Please sign in again.",
  403: "You don't have permission to do that.",
  404: "We couldn't find what you were looking for.",
  409: "That action conflicts with the current state. Refresh and try again.",
  413: "That file is too large. Please upload a smaller file.",
  429: "Too many attempts. Please wait a moment and try again.",
  500: "Something went wrong on our end. Please try again in a moment.",
  502: "Something went wrong on our end. Please try again in a moment.",
  503: "Something went wrong on our end. Please try again in a moment.",
  504: "Something went wrong on our end. Please try again in a moment.",
};

const GENERIC = "Something went wrong. Please try again.";
const OFFLINE = "You appear to be offline. Check your connection and try again.";
const VALIDATION = "Please review the highlighted details and try again.";

export function getErrorMessage(err: unknown, fallback: string = GENERIC): string {
  const http = asHttpError(err);

  // No HTTP response at all → network/offline (or a non-Axios throw).
  if (!http || http.response?.status == null) {
    // A plain Error with a human message still shouldn't leak "Network Error".
    return OFFLINE;
  }

  const status = http.response.status;
  const body = http.response.data;

  // Validation statuses: prefer the specific field/message the server gave.
  if (status === 422 || status === 400) {
    const field = firstFieldError(err);
    if (field && looksHuman(field)) return field;
    if (looksHuman(body?.message)) return body!.message!;
    return VALIDATION;
  }

  // Known status → fixed friendly copy (never trust the body here).
  if (STATUS_COPY[status]) return STATUS_COPY[status];

  // Unknown status: only surface the server message if it reads like human copy.
  if (looksHuman(body?.message)) return body!.message!;
  return fallback;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx tsx --test src/lib/api-error.test.ts`
Expected: `# pass 14  # fail 0`.

- [ ] **Step 6: Typecheck & commit**

Run: `npm run typecheck` → exit 0
```bash
git add src/lib/api-error.ts src/lib/api-error.test.ts package.json
git commit -m "feat(lib): add shared api-error helper with leak guard + tests"
```

---

### Task 2: Notify layer `notify.ts` (TDD for validation formatter)

**Files:**
- Create: `src/lib/notify.ts`
- Test: `src/lib/notify.test.ts`

**Interfaces:**
- Consumes: `getErrorMessage` from `./api-error`.
- Produces:
  - `notifyError(err: unknown, fallback?: string): void`
  - `notifySuccess(message: string, description?: string): void`
  - `notifyInfo(message: string, description?: string): void`
  - `notifyWarning(message: string, description?: string): void`
  - `notifyValidation(fields: string[]): void`
  - `formatValidationMessage(fields: string[]): string` (exported pure fn for testing)

- [ ] **Step 1: Write the failing test** — `src/lib/notify.test.ts`

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { formatValidationMessage } from "./notify";

test("single field reads as one line", () => {
  assert.equal(formatValidationMessage(["Email"]), "Please enter a valid Email.");
});

test("two fields join with 'and'", () => {
  assert.equal(formatValidationMessage(["First name", "Email"]), "Please complete: First name and Email.");
});

test("three+ fields comma-join with 'and'", () => {
  assert.equal(formatValidationMessage(["First name", "Email", "Province"]), "Please complete: First name, Email, and Province.");
});

test("empty list falls back to generic prompt", () => {
  assert.equal(formatValidationMessage([]), "Please complete the required fields.");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test src/lib/notify.test.ts`
Expected: FAIL — cannot find module `./notify`.

- [ ] **Step 3: Implement `src/lib/notify.ts`**

```ts
// Consistent, professional toast wrappers over sonner. Import these instead of
// calling `toast.*` directly so tone stays uniform.
//
// Copy rules: sentence case, no "successfully" filler, no trailing period on
// short success labels, never interpolate a raw error object.

import { toast } from "sonner";
import { getErrorMessage } from "./api-error";

export function formatValidationMessage(fields: string[]): string {
  const clean = fields.map((f) => f.trim()).filter(Boolean);
  if (clean.length === 0) return "Please complete the required fields.";
  if (clean.length === 1) return `Please enter a valid ${clean[0]}.`;
  if (clean.length === 2) return `Please complete: ${clean[0]} and ${clean[1]}.`;
  const last = clean[clean.length - 1];
  return `Please complete: ${clean.slice(0, -1).join(", ")}, and ${last}.`;
}

export function notifyError(err: unknown, fallback?: string): void {
  toast.error(getErrorMessage(err, fallback));
}

export function notifySuccess(message: string, description?: string): void {
  toast.success(message, description ? { description } : undefined);
}

export function notifyInfo(message: string, description?: string): void {
  toast.info(message, description ? { description } : undefined);
}

export function notifyWarning(message: string, description?: string): void {
  toast.warning(message, description ? { description } : undefined);
}

export function notifyValidation(fields: string[]): void {
  toast.error(formatValidationMessage(fields));
}
```

- [ ] **Step 4: Run test + typecheck**

Run: `npx tsx --test src/lib/notify.test.ts` → `# pass 4`
Run: `npm run typecheck` → exit 0

- [ ] **Step 5: Commit**

```bash
git add src/lib/notify.ts src/lib/notify.test.ts
git commit -m "feat(lib): add notify layer with consolidated validation toast"
```

---

### Task 3: Retire duplicated error parsers

Route every ad-hoc parser through `getErrorMessage` / `notifyError`. Delete the local copies. No behavior change except friendlier, guarded copy.

**Files:**
- Modify: `src/app/(app)/settings/branding/page.tsx` — delete local `showApiError`/`ApiError`; replace calls with `notifyError(err, "…")`.
- Modify: `src/app/(app)/settings/profile/page.tsx` — same.
- Modify: `src/app/(public)/register/page.tsx` — delete `submissionErrorMessage`; use `getErrorMessage(err, fallback)` where it built strings, or `notifyError`.
- Modify: `src/app/(app)/loans/[id]/page.tsx` — delete `extendErrorMessage`, `approvalErrorMessage`, and the inline release parser (~1833-1843); use `notifyError(err, "…")`.
- Modify: `src/lib/gcash-errors.ts` — keep the domain-specific tier/409 copy, but fall through to `getErrorMessage` instead of re-implementing the `{message,errors}` unwrap. Export unchanged `extractGCashErrorMessage` signature so its callers are untouched.
- Modify: `src/components/auto-pay-toggle-dialog.tsx`, `src/app/(app)/payments/auto-pay/page.tsx` (×2), `src/app/(app)/collaterals/_components/collateral-form.tsx`, `src/app/(app)/collaterals/page.tsx`, `src/app/(app)/settings/collateral-types/page.tsx` (×2), `src/app/(app)/users/page.tsx`, `src/app/(app)/settings/loan-products/page.tsx` — replace `err.message` / raw `data.message` fallbacks with `notifyError(err, "<friendly fallback>")`.

**Interfaces:**
- Consumes: `notifyError`, `getErrorMessage` (Tasks 1-2).

- [ ] **Step 1: `gcash-errors.ts` — delegate the tail to the shared helper**

Replace the trailing `firstMsg || message || fallback` logic with:
```ts
import { getErrorMessage } from "./api-error";
// ...keep tier(422)/409/403 special cases that return early...
// final line:
return getErrorMessage(err, "Something went wrong with that GCash action. Please try again.");
```

- [ ] **Step 2: branding + profile pages — remove `showApiError`**

Delete the `ApiError` type and `showApiError` function in each. Replace every `showApiError(err, "X")` with `notifyError(err, "X")`; add `import { notifyError } from "@/lib/notify";`.

- [ ] **Step 3: register page — remove `submissionErrorMessage`**

Delete the function. Where it was used to build a string then `toast.error(msg)`, replace with `notifyError(err, "We couldn't submit your application. Please try again.")`. Import `notifyError`.

- [ ] **Step 4: loans/[id] — remove the 3 local parsers**

Delete `extendErrorMessage`, `approvalErrorMessage`, and the inline release-error block. Replace their call sites with `notifyError(err, "<action-specific fallback>")` (e.g. "We couldn't release this loan. Please try again.").

- [ ] **Step 5: the `err.message` one-offs**

In each listed file, replace the raw `err.message` / raw `data.message` toast with `notifyError(err, "<friendly fallback>")`.

- [ ] **Step 6: Verify & commit**

Run: `npm run typecheck` → exit 0
Run: `npx tsx --test src/lib/api-error.test.ts src/lib/notify.test.ts` → all pass
```bash
git add -A
git commit -m "refactor(errors): route all error parsers through shared helper"
```

---

### Task 4: Convert login form to pop-ups

**Files:**
- Modify: `src/app/(auth)/login/page.tsx`

- [ ] **Step 1: Remove inline error rendering + state**

- Delete the `errors` state, the `border-destructive` conditionals on the two `<Input>`s (lines ~191, ~224), and the two `<p className="text-xs text-destructive">…</p>` blocks (~194, ~239).
- In `validate()`, collect labels of empty fields into an array; if non-empty call `notifyValidation(labels)` and return false. Labels: `"Username or email"`, `"Password"`.
- In the 422 branch, replace the inline `setErrors(...)` with `notifyError(error)` (the shared helper surfaces the field message). Keep the existing friendly 401/419/429/502/504/403 toasts (they already match the copy style — leave them).
- Import `notifyError, notifyValidation`.

- [ ] **Step 2: Verify & commit**

Run: `npm run typecheck` → exit 0. Manually: submit empty form → one consolidated toast; wrong password → friendly 401 toast; no red text remains.
```bash
git add src/app/(auth)/login/page.tsx
git commit -m "feat(login): replace inline field errors with pop-up toasts"
```

---

### Task 5: Convert register wizard to pop-ups

**Files:**
- Modify: `src/app/(public)/register/page.tsx`
- Modify: `src/app/(public)/register/_components/step-personal.tsx`
- Modify: `src/app/(public)/register/_components/step-contact.tsx`
- Modify: `src/app/(public)/register/_components/step-employment.tsx`
- Modify: `src/app/(public)/register/_components/step-photo-ids.tsx`

- [ ] **Step 1: Central page — drive validation via toast**

- Keep the `validatePersonal/validateContact/validateEmployment` pure functions but treat their returned object as "which fields failed". Build a **label list** from the failed keys using a `FIELD_LABELS` map (e.g. `first_name → "First name"`, `contact_number → "Contact number"`, `civil_status → "Civil status"`, `city → "City / Municipality"`, `province → "Province"`, `birthdate → "Date of birth"`, `gender → "Gender"`, `address → "Street address"`).
- On "Next"/submit: if the step has failures, `notifyValidation(labels)` and stop; do **not** set an `errors` state that renders red text.
- Remove the `errors` prop threading if it only fed inline text; keep the field-highlight only if trivial — otherwise drop it (spec: pop-ups only).

- [ ] **Step 2: Step components — remove inline `text-destructive` error `<p>`s and `border-destructive`**

In each step component, delete the `errors`-driven `<p className="…text-destructive">{errors.x}</p>` lines and the `border-destructive` conditional class. Leave required `*` asterisks. If a component no longer uses its `errors` prop, remove the prop from its interface and the parent's usage.

- [ ] **Step 3: Submission errors → notifyError**

Where the page catches submission failures, use `notifyError(err, "We couldn't submit your application. Please try again.")` (already partly done in Task 3 Step 3 — ensure consistency).

- [ ] **Step 4: Verify & commit**

Run: `npm run typecheck` → exit 0. Manually walk the wizard: leaving a step incomplete shows one consolidated toast naming the fields; no red inline text.
```bash
git add -A
git commit -m "feat(register): replace inline wizard errors with pop-up toasts"
```

---

### Task 6: Convert remaining inline-error forms

**Files:**
- Modify: `src/app/(app)/borrowers/new/page.tsx`
- Modify: `src/app/(app)/borrowers/[id]/edit/page.tsx`
- Modify: `src/app/(app)/borrowers/registrations/[id]/_components/registration-valid-ids-editor.tsx`
- Modify: `src/app/(app)/collaterals/_components/collateral-form.tsx`
- Modify: `src/app/(app)/loans/new/page.tsx`
- Modify: `src/app/(app)/loans/restructure/page.tsx`
- Modify: `src/app/(app)/gcash/_components/cash-in-dialog.tsx`, `cash-out-dialog.tsx`
- Modify: `src/app/(app)/settings/user-roles/page.tsx`, `src/app/(app)/settings/loan-products/page.tsx`
- Modify: `src/app/(app)/borrowers/registrations/[id]/_components/reject-dialog.tsx`, `review-action-panel.tsx`

- [ ] **Step 1: For each file, remove inline error text + border and add toasts**

- Delete `<p className="…text-destructive">{errors.x}</p>` and `border-destructive` conditionals.
- On client validation failure: build labels from failed keys, `notifyValidation(labels)`.
- On API 422: replace `setErrors(data.errors)` + raw-message toast with `notifyError(err)` (surfaces the server field message via the guard). For borrowers new/edit, remove the raw `toast.error(data.message)` (lines ~616/465) entirely.
- Keep the special "duplicate borrower → Create Anyway" flow logic; just swap its message source to `getErrorMessage`/a hand-written friendly string, never the raw `force=true` text.

- [ ] **Step 2: Verify & commit**

Run: `npm run typecheck` → exit 0.
```bash
git add -A
git commit -m "feat(forms): replace remaining inline field errors with toasts"
```

---

### Task 7: Normalize all remaining toast copy

Sweep every `toast.*` call for tone. Apply the copy style rules. This is rule-application, not new logic.

**Rulebook:**
- **Errors:** any `toast.error("Failed to load X")` → `toast.error("We couldn't load <the X>. Please try again.")`. Any `toast.error("Failed to <verb> X")` → `toast.error("We couldn't <verb> <the X>. Please try again.")`. Prefer `notifyError(err, "<that copy>")` when an error object is in scope.
- **Success:** drop "successfully"; sentence case; state the outcome. Canonical forms:
  - create → `"<Thing> created"` (e.g. "Member created", "User created", "Loan application created", "Role created", "Fee added", "Branch created", "Collateral type created", "Collateral registered")
  - update → `"<Thing> updated"`
  - delete → `"<Thing> deleted"`
  - domain verbs keep their verb: "Loan approved", "Loan rejected", "Loan released", "Loan submitted for review", "Payment posted", "Payment voided", "Logo updated", "Profile updated".
- **Never** show `err.message`, raw `data.message` on non-422, or interpolated error objects.

**Files (by module — sweep each):**
- Auth/shell: `login/page.tsx` (done), `components/layout/header.tsx`, `components/providers/session-provider.tsx`.
- Users: `users/page.tsx`.
- Borrowers: `borrowers/page.tsx`, `borrowers/new/page.tsx`, `borrowers/[id]/edit/page.tsx`, `borrowers/[id]/page.tsx`, `borrowers/registrations/[id]/page.tsx` + `_components/*`.
- Loans: `loans/page.tsx`, `loans/new/page.tsx`, `loans/restructure/page.tsx`, `loans/[id]/page.tsx`.
- Payments: `payments/page.tsx`, `payments/[id]/page.tsx`, `payments/history/page.tsx`, `payments/auto-pay/page.tsx`, `components/auto-pay-toggle-dialog.tsx`.
- Settings: `settings/{profile,branding,branches,loan-products,fees,collateral-types,user-roles,approval-workflow,gcash}/page.tsx`.
- Share capital: `share-capital/{page,ledger,pledges,auto-credit}` + `_components/*`.
- GCash: `gcash/page.tsx` + `gcash/_components/*`.
- Collaterals: `collaterals/page.tsx` + `_components/*`.
- Documents/Reports: `borrowers/[id]/_components/{documents-tab,co-maker-documents-dialog}.tsx`, `loans/[id]/_components/loan-documents-card.tsx`, `reports/[reportId]/page.tsx`.

- [ ] **Step 1: Sweep each module's files applying the rulebook.** Do one module per commit for reviewability.

- [ ] **Step 2: Grep audit for leaks**

Run these and confirm each returns nothing meaningful (only the shared helper / tests may match):
```bash
git grep -n "toast.error(err.message" -- src/
git grep -n "response?.data?.message" -- 'src/app/**' 'src/components/**'
git grep -n "successfully" -- 'src/app/**'
git grep -n "Failed to" -- 'src/app/**'
```
Expected: `successfully` and `Failed to` return zero hits in `src/app`; any remaining `data.message` reads go through `getErrorMessage`.

- [ ] **Step 3: Commit each module**

```bash
git add -A
git commit -m "polish(messages): normalize <module> toast copy"
```

---

### Task 8: Final verification

- [ ] **Step 1: Full checks**

Run: `npx tsx --test src/lib/api-error.test.ts src/lib/notify.test.ts` → all pass
Run: `npm run typecheck` → exit 0
Run: `npm run build` → exit 0

- [ ] **Step 2: Manual smoke (dev server)**

- Register: leave a step incomplete → one consolidated pop-up naming the fields; no red inline text.
- Login: wrong password → friendly 401 pop-up.
- Trigger a 500 (or offline) on any list page → "Something went wrong on our end…" / offline copy, never a status-code string.
- A successful create (e.g. a fee) → "Fee added" style success pop-up.

- [ ] **Step 3: Conflict check, push, PR**

```bash
git fetch origin development && git merge origin/development --no-commit --no-ff   # resolve if needed, else abort
git push -u origin feat/friendly-notifications
gh pr create --base development --title "feat: professional, non-technical error & success pop-ups" --body "…"
```
Confirm PR `mergeable: MERGEABLE`, `mergeStateStatus: CLEAN`, both CI checks SUCCESS.

## Self-Review

- **Spec coverage:** api-error.ts ✔ (Task 1), notify.ts + consolidated validation ✔ (Task 2), retire 8 parsers ✔ (Task 3), remove inline errors ✔ (Tasks 4-6), normalize all copy ✔ (Task 7), leak guard tested ✔ (Task 1), asterisks kept ✔ (Global Constraints). Verification ✔ (Task 8).
- **Placeholder scan:** status-copy map, test bodies, and helper implementations are fully written. Task 7 is rule-application with an explicit rulebook + canonical forms + a grep audit gate (no per-string enumeration is feasible for ~230, but the rules + audit make it deterministic).
- **Type consistency:** `getErrorMessage(err, fallback?)`, `getFieldErrors(err)`, `firstFieldError(err)`, `formatValidationMessage(fields)`, `notifyError/Success/Info/Warning/Validation` names are used identically across tasks.
