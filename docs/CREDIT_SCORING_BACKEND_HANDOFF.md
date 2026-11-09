# Credit Scoring: API contract and screens

## What this file is

The contract between the Credit Scoring screens and the API, as built: backend PR #240 (slice C2s) and the frontend slice FC. `src/types/credit-scoring.ts` holds the exact shapes and `src/services/credit-scoring.service.ts` the calls. Where this file and `docs/superpowers/specs/2026-09-15-credit-scoring-design.md` disagree, this file wins; the spec was written before the build.

Scores are **advice only**. No endpoint writes a loan, schedule, approval, payment or member row, and no screen does anything to a loan because of a score.

## The flag

The module stays behind `NEXT_PUBLIC_ENABLE_CREDIT_SCORING`, off by default.

- Off: the menu is hidden, every `/credit-scoring/*` route answers not found (`src/app/(app)/credit-scoring/layout.tsx`), and the loan page's Credit Assessment card renders nothing and sends no request.
- On: the screens below read the API. Each deployment switches it on once its API carries #240.

## Permissions

The backend seeds `credit_scoring:view`, `credit_scoring:override` and `credit_scoring:settings` for admin and super_admin only. Other roles get them through Settings > User Roles. The third verb is `settings`, not `configure`.

## The 14 routes

All are under `/api`, inside the authenticated group.

| # | Route | Permission | Answer |
|---|---|---|---|
| 1 | `GET /credit-scoring/dashboard` | view | Dashboard summary |
| 2 | `GET /credit-scoring/borrowers` | view | Page of `BorrowerScoreRow` |
| 3 | `GET /credit-scoring/borrowers/{borrowerId}` | view | `CreditScore` (the member's current score) |
| 4 | `GET /credit-scoring/borrowers/{borrowerId}/history` | view | Page of `CreditScoreHistoryEntry` |
| 5 | `GET /credit-scoring/borrowers/{borrowerId}/policy-flags` | view | `PolicyFlag[]`, active only, hard flags first |
| 6 | `GET /credit-scoring/score-history` | view | Page of `CreditScoreHistoryEntry` |
| 7 | `GET /credit-scoring/risk-monitoring` | view | Summary, affected members, alerts |
| 8 | `GET /credit-scoring/scorecard-config` | settings | `ScorecardConfig` |
| 9 | `PUT /credit-scoring/scorecard-config` | settings | `ScorecardConfig` after the save |
| 10 | `GET /credit-scoring/settings` | settings | `CreditScoringSettings` |
| 11 | `PUT /credit-scoring/settings` | settings | `CreditScoringSettings` after the save |
| 12 | `POST /credit-scoring/decisions` | override | `CreditDecision` (201) |
| 13 | `GET /credit-scoring/loans/{loan}/assessment` | view + `loans:view` | `LoanCreditAssessment` |
| 14 | `PUT /credit-scoring/loans/{loan}/assessment` | view + `loans:view` + `loans:update` | `LoanCreditAssessment` after the save |

There is no `GET /credit-scoring/alerts`: alerts come inside the risk monitoring answer. Decisions have no update or delete route; they are append-only.

## Envelope and paging

- Every answer is `{ success: true, data }`, and `api.get/put/post` return `data`.
- The three lists (routes 2, 4 and 6) answer a flat Laravel paginator in `data`: `data` (the rows), `current_page`, `last_page`, `per_page` and `total`, with no `meta`. The service reads it as `CreditScoringPage<T>`.
- Lists take `page` and `per_page`. The default is 25 rows, and `per_page` is clamped to 1 to 100.
- An answer without the rows or the paging figures throws, so a parse failure never reads as an empty list. The same goes for the policy flags list.
- Arrays are always `[]`, never null.
- Times are ISO 8601 with their offset (`+08:00`). Date filters (`from`, `to`) are inclusive Manila dates, `YYYY-MM-DD`.

## Branch scope

- `{borrowerId}` is resolved through `Borrower::visibleTo`, so a member in a branch the caller can't see answers 404, as do pending and rejected registrations. `{loan}` binds only visible loans (404).
- Lists, counts, risk monitoring and alerts cover only the members the caller can see, by the member's current branch. A `branch_id` filter outside the caller's branches answers 403; the branch picker offers only the caller's own.
- A score's `data_used` keeps only the loans and branches the caller can see, and `other_branch_loans` counts the loans left out. The screens say "N loans at branches you can't see are left out" and never fill in what's hidden.
- `financials_hidden` is true when the caller may not see the member's financial figures (it needs `loans:view` and `borrowers:view` in the member's branch, and sight of the loan the details came from). Then `capacity` is null, and the factor lines that would print income or debt read generic text. The screens show "Income and capacity figures are shown to staff who can read the member's details and loans."
- Without `branches:view_all`, a possible-duplicate flag's `detail` reads the rule's description, because the stored detail names the other member.
- Members are named by `borrower_id`, `borrower_name` and `borrower_code` only.

## Score states

| State | Fields | Screens show |
|---|---|---|
| `scored` | everything | The score out of 100 and the band |
| `insufficient_data` | `score` and `risk_level` null | "Insufficient data: no repayment or capacity data" (lists: "Insufficient data"), never a 0 or a band |
| `not_scored` (profile only, before the first score) | `id`, `score`, `risk_level`, `confidence`, `model_version`, `capacity` and `data_used` null; arrays `[]` | "Not scored yet", with no figures |

Every score also shows:

- "Advisory only, never changes a loan. Scorecard v{model_version}", plus ", not yet validated" while `validated` is false;
- a "Limited History" badge beside the Low confidence badge when `limited_history` is true, with the server's `confidence_reason`;
- `factors_without_data` under "No data yet", and "No data" for a category whose `has_data` is false.

The other nullables: `average_score` (no one scored, shown as "—") and an alert's `previous_score` (a first score).

## Figures and words

- **Money** (capacity, application details) comes as two-decimal peso strings. The screens show ₱ with two decimals, "—" for a missing figure and ₱0.00 for zero.
- `debt_service_ratio` is a percent string ("25.00") and shows with %.
- Settings rates come as JSON numbers (35 or 35.125), never rounded.
- `weight_percent` comes back as stored (a number or a string), and `min_score` is an integer.
- The browser never works out a score, band, capacity or money figure. `src/lib/credit-scoring/no-browser-math.test.ts` fails on a sum or a rounding in these screens.
- The server sends no words for `status`, `context`, an alert's `kind`, the capacity `assessment` (`manageable`, `caution`, `above_capacity`), `income_verification` (`verified`, `failed`, null) or decisions, so `src/lib/credit-scoring/labels.ts` maps them. Labels the server does send are shown as sent: `proposed_payment_basis`, `confidence_reason`, `recommendation`, `reason`, and every factor, flag, band and category label.

## Writes, 422 and 409

**Scorecard (`PUT /credit-scoring/scorecard-config`)** takes the whole config:

- `categories` with exactly the current keys, each once. Each weight is between 0 and 100 with at most two decimals, never rounded. The weights must total exactly 100.00, counted in hundredths, so 99.99 answers 422 on `categories`. The screen sends what was typed and shows that message at the table; there is no browser total check.
- `risk_bands` (optional): the six keys, minimum scores falling from very low to very high risk, the lowest 0. A 422 on `risk_bands` shows at the band editor.
- `factor_rules` and `policy_rules` may be left out; when sent they must equal the current ones (otherwise 422). The screen shows them read only and sends them back unchanged.
- A change writes a new immutable revision (the next minor version, unvalidated). New scores use it from the next nightly run; old scores keep their version. An unchanged save writes nothing.

**Settings (`PUT /credit-scoring/settings`):**

- The screen sends `privacy_notice` and the six policy figures as typed: `dsr_manageable_max`, `dsr_caution_max`, `capacity_share`, `max_active_loans`, `hard_past_due_days` and `decline_alert_points`.
- Rates are above 0 and at most 100 with at most four decimals, and the manageable level can't be above the caution level. `max_active_loans` is 1 to 100, `hard_past_due_days` 1 to 365, `decline_alert_points` 1 to 100. Each 422 shows at its field.
- `score_model_version` is read only (a body carrying it answers 422, "This field is read-only."), and the definition lists are the server's. Neither is ever sent.
- A changed notice takes the next `notice_version`.

**Decisions (`POST /credit-scoring/decisions`):** `borrower_id`, `credit_score_id`, `decision` (`approve`, `decline`, `refer`, `hold`), `reason` (required, at most 255 characters), optional `remarks`, and `loan_id` for a decision on a loan assessment's score (otherwise 422). A score of another member answers 422.

**Loan assessment (`PUT /credit-scoring/loans/{loan}/assessment`):**

- Only a draft or for-approval loan (otherwise 422). The GET's `editable` says which.
- The body carries the application details (a field left out is unchanged, null clears it) and `notice_acknowledged` (true stamps the current notice version; false clears it).
- The card sends only the fields that changed since they loaded, an emptied one as null, and `notice_acknowledged` only when the box changed. So a save never clears what the caller can't see: an earlier version's acknowledgement, or an application detail, which arrives as null without `borrowers:view` or the member's branch.
- When the assessment's `application_figures_hidden` is true (or the caller lacks `borrowers:view`), every application detail except the notice fields (`notice_version`, `notice_acknowledged` and `notice_acknowledged_at`) reads "Hidden (needs access to member details)", is locked and is never sent.
- The same caller gets the summary-only view, `details_hidden` true: the score's summary, no policy flags and no capacity block. The loan, the notice and the decisions stay.
- `employment_status` is one of the GET's `employment_statuses` (`employed`, `self_employed`, `business_owner`, `overseas_worker`, `retired`, `not_employed`, `other`). The four money fields are at most ₱9,999,999,999.99.
- It then assesses the application and answers the GET shape, which the card shows as it came back.
- 409 when the member is being scored and the 3-second wait runs out, or when two first saves collide. Nothing is saved then. The card shows 422 and 409 messages in place.

## Screens

| Screen | Reads |
|---|---|
| Dashboard | Route 1: scored members, average ("—" when null), insufficient data count, risk distribution, recent scores |
| Member Scores | Route 2, paged (25, 50, 100); a filter change goes back to page 1 |
| Member credit profile | Routes 3 and 5; the score history chart (route 4, latest 100, oldest to newest, insufficient data as a gap, "Latest 100 of N" when there are more) and the paged history beneath |
| Credit Assessment | Route 3 for a picked member; loan applications are assessed on the loan page |
| Risk Monitoring | Route 7; "Showing N of `affected_total`" when capped at 100 |
| Score History | Route 6, paged, with branch and date filters |
| Scorecard Configuration | Routes 8 and 9: weights, risk bands, read-only rules |
| Settings | Routes 10 and 11 |
| Loan page, Credit Assessment card | Routes 13 and 14 on draft and for-approval loans; decisions through route 12 with `loan_id` |

## Out of scope

No CIC or bureau data, no machine learning or risk-based pricing, and no Linda chat; the profile carries inert placeholders for CIC and Linda.
