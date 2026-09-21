# Multi-branch user assignment

A user can be assigned to several branches instead of exactly one. Shipped
2026-09-21 across `lendyph-frontend#358` and `lendyph-backend#127`.

This document exists because #358's body said a handoff "has been sent
separately" and it was committed nowhere. The Credit Scoring contract was lost
exactly that way and had to be reconstructed from the shipped TypeScript.

---

## Branch assignment is DISPLAY ONLY

**Read this before building anything on top of it.**

Assigning a user to branches grants nothing and restricts nothing. Verified
against `origin/main` on 2026-09-20:

- **Nothing anywhere reads the authenticated user's branch.** Not a controller,
  not a service, not a middleware.
- **There are zero global scopes.** `app/Policies` exists and is empty, with
  none registered.
- **`branch_id` on a list endpoint is a filter the client chooses.** On
  `GET /api/loans` it is `['nullable','integer','min:1']`, applied through
  `->when(filled($branchId), ...)`. **Omit the parameter and you get every
  branch's loans**, joined to borrower PII, plus org-wide `meta.stats`. The same
  shape holds for borrowers, users, reports and all eight accounting endpoints.

So today every authenticated user with `loans:view` already sees every branch.
The rule #358's body describes — *"a user can see data for every branch they're
assigned to"* — is **not a relaxation of an existing boundary. It would be the
first branch boundary that has ever existed.**

`tests/Feature/BranchAssignmentIsDisplayOnlyTest.php` characterises this, so it
cannot change quietly. If you are adding scoping, that test failing is the
signal to read this section, not to edit the assertion.

Scoping would touch ~10 list endpoints, ~100 query sites in `ReportService`,
8 accounting controllers, and `tests/Traits/SetupLendyPH`, which ~90 test
classes inherit. It deserves its own branch and its own security review.

---

## The contract

The API answers **both** shapes for this release.

### Reads — `UserResource`

| key | type | note |
|---|---|---|
| `branch` | object or absent | legacy, unchanged |
| `branches` | array or absent | new |

Both use `whenLoaded`, so a caller that eager-loads neither gets neither key —
**absent, not null**. Clients must treat a missing key and an empty array the
same, and must not assume `branches` is present.

Eager-loaded on all seven sites: `AuthController` login / me / updateMe, and
`UserController` index / store / show / update.

`UserResource` is also embedded by `AuditLogResource`, `BorrowerResource` and
`LoanResource` for nested actor payloads, which is why `branch` staying is not
optional — removing it would change all of them at once.

### Writes — `StoreUserRequest` / `UpdateUserRequest`

| key | rule |
|---|---|
| `branch_ids` | `sometimes, array, min:1`; each `integer, exists:branches,id` |
| `branch_id` | unchanged, still accepted |

`branch_ids` is synced **outside** `fill()`, as `role` already is — it is a
pivot, not a column.

### Schema

`branch_user` (`user_id`, `branch_id`), unique on the pair,
`cascadeOnDelete` both ways. **No timestamps, deliberately** — see below.
`users.branch_id` is retained this release.

---

## Three things that will bite you

**1. The pivot has no timestamps on purpose.**
`TimezoneShiftTest::test_the_column_map_matches_the_live_schema` asserts every
datetime column in the live schema appears in `TimezoneShift::COLUMNS`. An
unregistered table **fails the entire suite**, not one test. If you add
`timestamps()` to `branch_user` you must register it. `co_maker_loan` is the
other pivot here and it does carry them.

**2. A pivot is invisible to `isDirty()`.**
`UpdateUserRequest::changesAnyColumn()` derives its column list from
`array_keys($this->rules())` and tests it with `fill()` + `isDirty()`. A pivot
never reaches either, so without explicit handling **a branch-only edit answers
422 "Nothing to update."** Both `branch_ids` and `branch_ids.*` are excluded —
the latter is a `rules()` key in its own right — and branch change-detection is
separate and **order-insensitive**: `[1,2]` and `[2,1]` are the same assignment.

**3. `users.branch_id` is not the source of truth any more.**
It is retained for the dual window and backfilled into the pivot. Read
`branches`. Dropping the column is a second migration once the dual window
closes.

---

## What the frontend does

`src/lib/user-branches.ts` reads `branches ?? (branch ? [branch] : [])`, using
`Array.isArray` rather than `?? []` — untyped JSON can hand back
`branches: null`, which `??` would pass straight to `.map()`.

Writes send **both** `branch_ids` and `branch_id`, the latter derived from the
set rather than selection order, so a reorder cannot ship a different scalar
through a change-check that correctly reports "no change".

`lendy-auth` carries `version: 1` with `migrate` **and** `merge`. `merge` is not
redundant: it covers what `migrate` structurally cannot — a session created
*after* this ships against a backend still emitting only `branch` persists the
old shape under the *current* version, so no version mismatch ever fires.

---

## Verified end to end

On `binhs_coop_staging`, the only deployment with more than one branch
(2 branches, 8 users) — every production co-op has exactly one, so the feature
cannot be exercised there yet:

| | |
|---|---|
| migration + backfill | 8 pivot rows for 8 users, none missing |
| assign two branches | `200`, both persist |
| reorder the same set | `422`, refused as no change |
| branch-only edit | `200`, saves |
| legacy `branch_id` alone | `200`, still works |
| `/auth/me` | returns `branch` **and** `branches` |

Backend suite **2025 passed**. Frontend **1304 passing**, lint 92/0 unchanged,
Playwright 5/5 against staging.

---

## Still open

- **Branch scoping** — the boundary itself. See the top of this document.
- **Dropping `users.branch_id`** once the dual window closes.
