# Loan Origination: backend handoff

The frontend is built behind `NEXT_PUBLIC_ENABLE_LOAN_ORIGINATION`. None of these
endpoints exist yet (Swagger returned 404 when this was written). Until they do,
every screen shows "Not connected yet". Field shapes are in `src/types/loan-origination.ts`.
Paths are in `API_ENDPOINTS.LOAN_ORIGINATION` and `API_ENDPOINTS.PUBLIC_APPLY`.

## Permissions to seed

`loan_origination:view|update|assess|convert|settings`. Seed all five for admin and
super_admin; loan officers get view, update and assess.

## Staff API (`/loan-origination/*`, bearer auth)

- `GET dashboard?date_from&date_to&branch_id`: KPI counts, conversion funnel and
  average turnaround, scoped to the caller's branches.
- `GET applications`: a paginated list (`per_page` ≤ 100) with search, status, branch,
  product, officer and date filters. `meta.stats` holds counts per status for the tabs.
- `GET applications/{id}`: the detail view, with draft, documents, assessment, notes and status history.
- `POST applications/{id}/transition {to, note}`: only moves allowed by
  `STAFF_TRANSITIONS` in `src/lib/loan-origination.ts`. Write a status-history row; 422 for any other move.
- `POST .../assign {officer_id|null}`, `POST .../notes {body}`, `POST .../link-member {borrower_id|null}`.
- `POST .../request-information {message, document_types[]}`: sets
  `additional_info_required`, marks those documents `replacement_requested`, and notifies the applicant.
- `POST .../remind`: texts or emails the resume link for an unfinished draft.
- `POST .../submit-for-approval`: needs an assessment; sets `pending_approval`.
- `POST .../convert` (`loan_origination:convert`): only for `approved` with no
  `loan_id`. Creates the borrower (if not linked) and the loan from the draft with
  the product's term, frequency and interest method, then returns `{loan_id}`.
- **Assessments.**
  - `GET assessments` (paginated, `meta.stats`) lists them.
  - `POST applications/{id}/assessment/rerun` runs the assessment again.
  - `PATCH .../assessment {officer_findings, recommendations}` saves the officer's notes.
  - `GET .../assessment/history` lists past runs.
  - `GET .../assessment/pdf` returns the report as a PDF.
  - The server computes DTI, coverage and remaining income from the settings: income recognition per source,
    expenses, existing debts, and the new installment from the product's amortization.
    Mark the assessment `provisional` while income is unverified.
- **Documents.**
  - `GET documents` is the queue (paginated, `meta.stats`).
  - `POST documents/{id}/verify {notes}` verifies a file.
  - `POST .../reject {reason}` rejects it.
  - `POST .../request-replacement {reason}` asks for another file.
  - `GET .../download` returns the file.
- **Links.**
  - `GET|POST links` lists and creates links. `PATCH links/{id}` updates one.
  - `POST links/{id}/logo` takes a multipart `logo`.
  - A link holds a random token, a branch, product ids, an expiry and an active flag.
    It counts visits, starts and submissions.
- `GET|PUT settings`: the whole `OriginationSettings` object.

## Public API (`/public/apply/{token}`, no account)

- `GET`: the portal. Return `accepting=false` with `closed_reason` when the link is
  disabled or expired, or the feature is off. Return 404 for an unknown token.
- `POST otp {channel, mobile, email?, purpose: apply|resume|track, reference_number?}`:
  rate-limited. Returns `{resend_after, expires_in, channel, destination(masked)}`.
- `POST otp/verify {…target, code}` returns `{session_token, expires_at, application}`.
  - `apply` creates a draft, or returns the open one for that mobile.
  - `resume` returns the open draft, or 404.
  - `track` requires a matching reference.
  - Every call after this sends the session token in an `X-Application-Session` header.
- `PUT draft {draft, last_step}`: autosave. Store the draft as JSON and keep `completion_percent`.
- `POST estimate {loan_product_id, amount, term, frequency}`: run the product's real
  amortization and charges. Return `LoanEstimate`. Save nothing.
- `POST documents` takes a multipart `type` and `file`. Check the content type, size and
  malware on the server. A new file for the same type becomes a new version.
  `DELETE documents/{id}` removes a file.
- `POST submit {privacy_notice_version, terms_version, declaration_version, credit_authorization_version, marketing_opt_in}`:
  - Validate the draft and the required documents.
  - Record the consents with their versions, the time and the IP.
  - Assign the reference number and set `submitted`.
  - Idempotent per session.
- `GET track`: the borrower-facing status, outstanding requirements, the documents to
  upload again, and the decision notice. Never return internal notes.
