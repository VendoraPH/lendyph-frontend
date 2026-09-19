# Credit Scoring — backend handoff

## Why this file exists

The Credit Scoring frontend shipped to production in September 2026 as a complete UI shell: 7 sidebar entries, 8 routed pages, 11 endpoints wired through a typed service. The backend contract was delivered only as a chat message and was never committed — the design spec's own last section says so. This file reconstructs that contract from the shipped code, which is the only surviving source of truth.

Where this file and `docs/superpowers/specs/2026-09-15-credit-scoring-design.md` disagree, **this file wins**. The spec was written before implementation and its TypeScript block drifted substantially during the build (details at the end).

## Read this before granting any permission

Checked `VendoraPH/lendyph-backend`, branches `development` and `main`, on September 19, 2026: **`credit_scoring` does not appear anywhere.** No permission, no route, no migration, no seeder. All 11 endpoints below return 404 today.

The module is invisible in production for exactly one reason: the server sends no `credit_scoring:*` permission, so `can(item.permission)` in `src/components/layout/sidebar.tsx` drops the whole nav block. That is the only thing holding it back.

- `RouteGuard` (`src/components/common/route-guard.tsx`) is **not** a second line of defence. It reads the same `user.permissions` from the same auth store as the sidebar, so it admits precisely the users the sidebar shows the link to.
- `src/constants/rbac.ts` is documentation, not a gate — editing it grants nothing. But it records what each role is *meant* to hold, and a seeder written from it would give **admin** all 7 menu items, **loan_officer** 5, **manager** 5.

So: **seeding the permissions without the routes puts 7 dead menu items in front of 3 roles with no frontend change, no deploy and no review.**

**Grant the permissions in the same release that ships the routes.** Not earlier.

### The degradation rule (why "permissions first" is worse than it sounds)

Every screen renders through `DataState` (`src/components/common/data-state.tsx`), driven by `useApiResource` (`src/hooks/use-api-resource.ts`). That hook sets its `unavailable` flag **only on HTTP 404 or 501** — every other status becomes a red "Something went wrong" error card.

- Today, with no routes at all, the screens 404 and show a calm **"Not connected yet"** panel that names the endpoint it is waiting on. This is the intended pre-backend state.
- A backend that has been taught the permissions but not the routes — or that has routes gated on a permission the caller lacks, or that 500s on an unfinished controller — answers **403 or 500**. Those screens then render as **red error states**, and the module degrades from an honest placeholder into an app that looks broken.

If routes must land before they are complete, return **501 Not Implemented**, never 403 or 500.

The same 404/501 test is duplicated in three write paths, which toast "Not connected yet" instead of a failure: the scorecard save, the settings save, and the decision dialog.

## Permission names — exact strings

| Permission | Gates |
|---|---|
| `credit_scoring:view` | All 5 read screens: Dashboard, Borrower Scores, borrower profile, Credit Assessment, Risk Monitoring, Score History |
| `credit_scoring:settings` | Scorecard Configuration + Settings pages (both read and write) |
| `credit_scoring:override` | The Record Decision action on the borrower profile — an action, not a page |

**The third verb is `settings`, not `configure`.** The design spec originally said `credit_scoring:configure`; the shipped code checks `credit_scoring:settings`, mirroring `accounting:settings` (`src/types/rbac.ts`, `src/constants/navigation.ts:131,134`, `src/constants/rbac.ts`). The spec has since been corrected, but a backend seeded from an older copy would create a permission nothing reads — and both admin screens would stay dark for everyone, including admins.

## Response envelope

`src/lib/api-client.ts` returns `response.data.data` for every `get`/`post`/`put`. **Every endpoint below must answer with the standard `{ success, data, message? }` envelope**, payload inside `data`.

For the four list endpoints, the service then calls `unwrapList`, which accepts either shape:

- `data: [ ...rows ]` — a bare array, or
- `data: { data: [ ...rows ], ... }` — a nested Laravel paginator

Anything else **throws** rather than returning `[]`. That is deliberate and should stay that way: this is a risk module, and "this borrower has no policy flags" must never be indistinguishable from "we could not parse the response."

**Arrays must never be null.** The screens call `.map()`, `.filter()` and `.length` on every array field below without a guard, so a `null` is a client-side crash, not an empty state. Send `[]`.

Numeric fields should be JSON numbers. `weight_percent` is the one field explicitly tolerated as a decimal string, because Laravel serialises `decimal:2` that way and `sumWeights` coerces with `Number()` — see the comment in `src/lib/credit-scoring/scorecard-weights.ts`, which documents the bug that taught us this.

## Pagination

The two filtered list endpoints send `per_page: 100` (`MAX_PER_PAGE`) explicitly and **do not paginate** — there is no drain, no page control, no "showing N of M". A co-op with more than 100 scored borrowers, or more than 100 score-change rows in the selected range, will silently see a truncated list presented as the whole portfolio. Six screens in this repo have already shipped that bug.

List endpoints elsewhere in this API clamp `per_page` at 100 silently. Keep that ceiling. If these lists can realistically exceed it, say so at handback and the frontend will add a `fetchAllPages()` drain — do not raise the cap instead.

## The 11 endpoints

### 1. `GET /credit-scoring/dashboard`
**Permission:** `credit_scoring:view` · **Screen:** `/credit-scoring` · **Request:** none

Portfolio summary. Response (`CreditScoringDashboardSummary`):

```
total_scored_borrowers  number
average_score           number          rendered .toFixed(1); null tolerated, shown as 0.0
risk_distribution       { risk_level: RiskLevel; count: number }[]
recent_score_changes    CreditScoreHistoryEntry[]
```

`risk_distribution` feeds a donut chart keyed on `risk_level`, so each entry must use one of the six `RiskLevel` values exactly and appear at most once — an unknown value renders an uncoloured slice. Note the field is a **count**, not a percentage.

### 2. `GET /credit-scoring/borrowers`
**Permission:** `credit_scoring:view` · **Screen:** `/credit-scoring/borrowers`

**Query:** `per_page=100` always, plus optional `branch_id` (number) and `risk_level` (one `RiskLevel`). Both are omitted entirely when the filter is "All" — never sent as `0`, `""` or `"all"`. The type also declares `min_score`, `max_score`, `borrower_type`, `loan_product_id`, `has_active_loan`, `past_due`; no screen sends them yet, so support them only if cheap.

**Response:** `BorrowerScoreRow[]`

```
borrower_id    number      React key — must be unique per response
borrower_name  string
branch_id      number
branch_name    string
score          number      0-100
risk_level     RiskLevel
score_trend    "up" | "down" | "flat"
has_active_loan boolean
past_due       boolean
calculated_at  string      ISO 8601
```

Rows are click-through to `/credit-scoring/borrowers/{borrower_id}`, so every `borrower_id` here must resolve at endpoint 3.

### 3. `GET /credit-scoring/borrowers/{borrowerId}`
**Permission:** `credit_scoring:view` · **Screens:** borrower profile `/credit-scoring/borrowers/[id]` **and** Credit Assessment `/credit-scoring/assessment`

The single most important response. Both screens call this same endpoint — Credit Assessment is the same panel with a borrower picker in front of it, so there is no separate "run an assessment" endpoint and no POST. If assessments are ever to be *computed on demand* rather than read, that is a new endpoint and a frontend change; it is not this one.

**Response:** `CreditScore`

```
id                  number    the credit_score row id — posted back as credit_score_id at endpoint 10
borrower_id         number
borrower_name       string    used as the page title
score_type          "application" | "behavioral"
score               number    0-100, rendered against a literal "out of 100"
risk_level          RiskLevel
confidence          "high" | "medium" | "low"
model_version       string    NOT score_model_version
category_breakdown  ScoreCategoryBreakdown[]
factors             ScoreFactor[]        one array, positive and risk together
recommendation      string    NOT system_recommendation
calculated_at       string    ISO 8601
```

`ScoreCategoryBreakdown`:

```
category         string    rendered verbatim as the row's visible label, and used as its React key.
                           There is no separate `label` field. Send human-readable text
                           ("Repayment Behaviour"), not a snake_case key, and make it unique per response.
weight_percent   number    displayed as "… · {n}% weight"
points_earned    number
points_possible  number    the progress bar is points_earned / points_possible; 0 is handled, negative is not
```

`ScoreFactor`:

```
id        number                  React key — must be unique across the whole factors array
label     string                  bold headline
detail    string                  supporting line
impact    "positive" | "risk"     the ONLY thing that sorts a factor into the two columns
category  string                  rendered verbatim in a badge — human-readable, same as above
```

**Business rule the UI already states:** `recommendation` is advisory free text shown under the heading "System Recommendation". The dialog at endpoint 10 tells the user in so many words that "This score is a recommendation only." The system must never auto-decide, and this string must never read as a verdict like `APPROVED` / `DENIED`.

### 4. `GET /credit-scoring/borrowers/{borrowerId}/history`
**Permission:** `credit_scoring:view` · **Response:** `CreditScoreHistoryEntry[]`

Per-borrower score ledger. Defined in the service as `getBorrowerScoreHistory` but **not currently called by any screen** — the profile page does not yet render a history chart. Build it for parity with endpoint 5 or defer it; if you defer it, return 501 rather than leaving it unrouted, and say so at handback.

### 5. `GET /credit-scoring/score-history`
**Permission:** `credit_scoring:view` · **Screen:** `/credit-scoring/score-history`

**Query:** `per_page=100` always, plus optional `branch_id` (number), `from` and `to` (ISO date strings `YYYY-MM-DD`, taken straight from `<input type="date">`). `borrower_id` exists in the filter type but no screen sends it. Omitted keys mean unfiltered. `from`/`to` should be inclusive.

**Response:** `CreditScoreHistoryEntry[]`

```
id             number       React key — unique per response
borrower_id    number
borrower_name  string?      optional, but send it — see the decision below
score          number
risk_level     RiskLevel
score_type     "application" | "behavioral"
model_version  string
calculated_at  string       ISO 8601
reason         string       free text, e.g. "Recent payment delinquency increased risk"
```

**Decided 2026-09-19 — send `borrower_name`.** This was posed here as a question awaiting a backend answer; there is no third party to answer it, so it is settled and the frontend side has shipped: `CreditScoreHistoryEntry` now carries an optional `borrower_name`. See `docs/BACKEND_ISSUES.md` #2.

**What the backend must do:** add `borrower_name` to this endpoint's rows, and to `recent_score_changes` in endpoint 1 and the rows of endpoint 4 — they are the same type and the same two screens read it. Send the same name the borrower resource sends (`full_name`), resolved server-side in the same query; do not expect the client to join it.

**It stays optional in the type, and that is deliberate.** Both screens now render through `borrowerLabel()` (`src/lib/credit-scoring/borrower-label.ts`), the house fallback chain narrowed to the two fields this row carries: `borrower_name` when present, else the previous `Borrower #{borrower_id}` literal. A blank or whitespace-only name is treated as absent. So a backend that ships without the field degrades to exactly today's output rather than a blank Borrower column — but it ships an id where staff expect a name, which is the whole point of the change.

The frontend must **not** client-side join this via `borrowerService.listAll()`: that drains the entire borrower portfolio to label one table. (`/credit-scoring/assessment` does drain, to populate a borrower picker — a different justification, and not a precedent for a table label.)

Dates: this app runs on Philippine time (UTC+8). Return ISO 8601 with an offset and let the client format; the frontend uses `formatDateTime`/`formatDate` and never slices a date out of a UTC string.

### 6. `GET /credit-scoring/risk-monitoring`
**Permission:** `credit_scoring:view` · **Screen:** `/credit-scoring/risk-monitoring` · **Request:** none

One composite response, not three calls. `RiskMonitoringData`:

```
summary             RiskMonitoringSummary
affected_borrowers  BorrowerScoreRow[]      same shape as endpoint 2, click-through to endpoint 3
alerts              RiskAlert[]
```

`RiskMonitoringSummary` — all four are counts rendered as plain integers:

```
total_borrowers      number
high_risk_count      number
score_declines_30d   number
new_hard_flags_30d   number
```

The two `_30d` fields are explicitly rolling-30-day windows; the labels on screen read "Score Declines (30d)" and "New Hard Flags (30d)".

`RiskAlert`:

```
id              number                            React key
borrower_id     number
borrower_name   string
message         string
previous_score  number    rendered as "previous → current"
current_score   number
severity        "info" | "warning" | "critical"   drives the badge variant; an unknown value renders undefined
created_at      string
```

This response is unpaginated and unfiltered. If `affected_borrowers` can run to thousands, cap it server-side at a sane number and tell us, rather than sending everything.

### 7. `GET /credit-scoring/alerts`
**Permission:** `credit_scoring:view`

Declared at `src/config/api-endpoints.ts` as `ALERTS_LIST` but **has no service method and no caller** — alerts reach the UI embedded in endpoint 6's response. It is a leftover from the spec's `listAlerts()`. **Do not build it** unless a standalone alerts screen is scheduled; it is listed here only so nobody finds the constant later and assumes it is a gap.

### 8. `GET` + `PUT /credit-scoring/scorecard-config`
**Permission:** `credit_scoring:settings` for **both** · **Screen:** `/credit-scoring/scorecard-configuration`

**Response (both verbs):** `ScorecardConfig`. The PUT must return the saved config in the same shape — the page refetches after save, but reads the response first.

```
categories    ScorecardCategoryConfig[]   { key, label, weight_percent, description }
                                          `key` is the React key and must be unique; `label` and
                                          `description` are the visible text (unlike endpoint 3,
                                          this type does have its own label)
factor_rules  ScorecardFactorRule[]       { id, category_key, label, points, is_active }
policy_rules  PolicyRule[]                { id, label, description, is_active }
```

**PUT request body:** the entire `ScorecardConfig` object, not a patch — including `factor_rules` and `policy_rules` unchanged. Their toggles are rendered `disabled` in this build, so the UI cannot alter them today; they round-trip untouched. Accept and ignore, or validate that they match, but do not 422 on their presence.

**Business rule, enforced client-side and to be re-enforced server-side:** `categories[].weight_percent` must sum to **exactly 100**. The Save button is disabled otherwise (`isValidWeightTotal`, which rounds to two decimals first so a visibly-100 total of values like 16.67 is accepted). Client-side validation is a convenience; reject a non-100 total with a 422 regardless.

The spec expects six categories — repayment behaviour, payment capacity, credit exposure, stability, Lendy relationship, application quality — but the frontend renders whatever it is sent and does not hard-code the number.

### 9. `GET /credit-scoring/borrowers/{borrowerId}/policy-flags`
**Permission:** `credit_scoring:view` · **Screen:** borrower profile

**Response:** `PolicyFlag[]`

```
id            number                        React key
type          "hard_flag" | "soft_flag"     drives the red/amber card and the badge
label         string
detail        string
triggered_at  string                        ISO 8601
```

It is called from the borrower profile alongside endpoint 3, as a separate request with its own loading state. Note the shipped type is a simple hard/soft split with no `severity` and no `borrower_id` — the spec's seven-value enum (`current_past_due`, `prior_writeoff`, …) belongs in `label`/`detail`, not in `type`.

### 10. `POST /credit-scoring/decisions`
**Permission:** `credit_scoring:override` · **Screen:** Record Decision dialog on the borrower profile

**Request** (`CreateCreditDecisionData`):

```
borrower_id      number
credit_score_id  number    the `id` from endpoint 3's response — ties the decision to the exact score seen
decision         "approve" | "decline" | "refer" | "hold"
reason           string    required, trimmed, non-empty — the UI will not submit without it
remarks          string?   omitted entirely when blank, never sent as ""
```

Note the verbs are **bare, not past tense**: `approve` / `decline` / `refer` / `hold`. The spec said `approved` / `declined` / `manual_review`; the code shipped the four above and those are what the wire carries.

**Response** (`CreditDecision`): the created row —

```
id, borrower_id, credit_score_id, decision, reason,
remarks     string | null
decided_by  string           a display name, not an id — rendered directly
decided_at  string           ISO 8601
```

**Business rules:**
- `reason` is mandatory. Validate server-side too; the client only trims and length-checks.
- The dialog tells the user this "writes to an immutable audit trail". Honour that: decisions are append-only, no update and no delete endpoint exists or should.
- This records a *human* decision against an advisory score. It must not itself approve, decline or otherwise mutate a loan — the frontend refetches the credit profile afterwards and nothing else.
- Scope `borrower_id` and `credit_score_id` to the authenticated user's own deployment; never trust them as authorisation. Each deployment is single-tenant (one co-op per instance and database), so there is no tenant id on the wire — do not add one.

### 11. `GET` + `PUT /credit-scoring/settings`
**Permission:** `credit_scoring:settings` for both · **Screen:** `/credit-scoring/settings`

**Response (both verbs):** `CreditScoringSettings`

```
privacy_notice          string
score_model_version     string
confidence_definitions  { level: "high"|"medium"|"low"; label: string; description: string }[]
                        `level` is the React key — each of the three at most once
hard_flag_definitions   { type: "hard_flag"|"soft_flag"; label: string; description: string }[]
                        `type` is the React key — so at most two entries, one per type
```

**PUT request body:** typed `Partial<CreditScoringSettings>`. The page sends the whole object **minus `score_model_version`** (see below), definitions included. Accept and ignore the definition arrays if they are server-owned reference data.

Two notes before you build this:

- **`score_model_version` is read-only. Decided 2026-09-19** — this was posed here as a question awaiting a backend answer; there is no third party to answer it, so it is settled. The field is immutable: the spec calls it a "current model version display (read-only)" and its versioning rule has the value "stamped at calculation time, immutable per history row", which endpoints 3 and 5 return per score. The Settings page no longer renders it as an input — it is plain text beside the other read-only definition cards — and `handleSave` **omits the key from the PUT body entirely** (`updateSettings` takes a `Partial<CreditScoringSettings>`, so an absent key is already in contract). See `docs/BACKEND_ISSUES.md` #3.

  **What the backend must do:**
  1. Keep returning `score_model_version` on `GET`, and on the `PUT` response — the page refetches but reads the response first.
  2. **Do not mark it `required` on the `PUT` validator.** This app never sends it; a `required` rule would 422 every save from the Settings page.
  3. **If a request body does carry the key, reject it with a 422** — e.g. `{"errors": {"score_model_version": ["This field is read-only."]}}` — rather than silently accepting and discarding the write. The frontend's 404/501 check means a 422 surfaces as "Unable to save settings", which is the correct outcome for a client trying to write an immutable field.
  4. The value changes only when the scoring model itself is deployed; it is not a settings knob for staff.

- **`privacy_notice` is borrower-facing legal text** under the Philippine Data Privacy Act (NPC disclosure), per the note rendered beneath the field. Treat edits as auditable.

## Business rules the frontend already assumes

1. **The system never decides.** `recommendation` is advisory free text; only `POST /credit-scoring/decisions` records an outcome, and only from a human with `credit_scoring:override`.
2. **Scores are 0-100**, internal, and not a CIC/bureau range. The profile renders a literal "out of 100" beneath the number.
3. **`risk_level` is authoritative from the server.** `riskLevelFromScore()` exists in `src/lib/credit-scoring/risk-level.ts` but is used only for a live preview while an admin edits thresholds — the frontend never recomputes a real borrower's risk level. Always send `risk_level` explicitly; do not expect the client to derive it.
4. **Policy flags fail loud.** If `GET .../policy-flags` errors *or* 404s, the profile replaces the flag area with "Policy flags unavailable — treat this borrower as unscreened for hard flags until this is resolved." It does not fall back to "no flags". Return `[]` for a genuinely clean borrower.
5. **Category and factor `category` strings are shown to users verbatim.** See endpoint 3.
6. **Single-tenant per deployment.** One co-op per instance and database; there is no tenant model. Scope everything to the authenticated account and branch assignment server-side. The spec's `tenant_id` fields do not exist in the shipped types and should not be added.
7. **Branch scoping is a server concern.** `branch_id` arrives only as a user-chosen *filter*; a manager's restriction to their own branch must be enforced from their assignment, exactly as accounting does it.

## Where the spec is wrong

`docs/superpowers/specs/2026-09-15-credit-scoring-design.md` carries a full TypeScript block that **did not survive implementation**. Building from it will produce a backend the frontend cannot read. Beyond the `configure`/`settings` rename, the differences include:

| Spec said | Shipped code uses |
|---|---|
| `CreditScore.score_model_version` | `model_version` |
| `CreditScore.system_recommendation` | `recommendation` |
| `CreditScore.categories` | `category_breakdown` |
| `CreditScore.positive_factors` + `risk_factors` (two arrays) | one `factors` array, split client-side on `impact` |
| `CreditScore.tenant_id`, `loan_application_id`, `confidence_reason`, `suggested_max_monthly_payment`, `debt_service_ratio` | do not exist |
| `ScoreCategoryBreakdown` `{ category enum, label, points, max_points, summary }` | `{ category: string, weight_percent, points_earned, points_possible }` |
| `ScoreFactor` `{ type, label }` | `{ id, label, detail, impact, category }` |
| `CreditScoreHistoryEntry.trigger_event`, `delta` | do not exist; `score_type` does |
| `PolicyFlag` `{ borrower_id, 7-value type enum, message, severity, created_at }` | `{ id, "hard_flag"\|"soft_flag", label, detail, triggered_at }` |
| `CreditDecision.decision` `approved`/`declined`/`manual_review`; `approved_by`/`approved_at` | `approve`/`decline`/`refer`/`hold`; `decided_by`/`decided_at` |
| `ScorecardCategoryConfig.category` | `key`, plus a `description` |
| `ScorecardFactorRule` `{ category, factor, label, bands[] }` | `{ id, category_key, label, points, is_active }` |
| `RiskMonitoringSummary` `{ score_declined_count, new_high_risk_count, past_due_borrowers_count, high_risk_exposure_total }` | `{ total_borrowers, high_risk_count, score_declines_30d, new_hard_flags_30d }` |
| `CreditScoringDashboardSummary` ~10 fields incl. `risk_by_branch`, `risk_distribution[].percent` | 4 fields; `risk_distribution[].count`, plus `recent_score_changes` |

`src/types/credit-scoring.ts` is the authority. Read it directly before writing a resource class.

## Explicitly out of scope

Unchanged from the spec: no scoring computation is specified here, no nightly recalculation jobs, no ML/PD models, no IFRS ECL, no CIC integration and no Linda chat wiring — the profile carries inert placeholders for the last two. Embedding the assessment panel into the loan application flow is a separate frontend PR; `CreditAssessmentPanel` already takes only a `borrowerId` so that it can be dropped in.

What this file *does* fix is the part that was never written down: the wire contract, the permission names, and the order in which permissions and routes must ship.
