# Member Portal: backend handoff (Phase 3, part 1: foundation)

The frontend is built and sits behind `NEXT_PUBLIC_ENABLE_MEMBER_PORTAL`, which is off by default. None of these routes exist in `lendyph-backend` yet; Swagger could not be reached, so this contract has not been checked against it. Until a route lands, its screen shows "Not connected yet" (404/501).

All responses use the usual `{ success, data }` envelope. Field shapes are in `src/types/portal.ts`.

## Member auth: a separate guard

- A **member token** belongs to a borrower, not a `users` row. Use a separate Sanctum guard or token ability (for example `portal`), so a member token can never call staff routes and a staff token can never call `/portal/*` routes (except `/portal/config`).
- **Every `/portal/*` route resolves the member from the token.** There is never a member id in the path or the body. This is the main IDOR guard.
- Login and activation return `{ token, expires_in (seconds), member }`. The frontend signs the member out when `expires_in` elapses, and on any 401.
- Respect `session_minutes` from the settings when you issue a token.

| Method | Path | Logic |
|---|---|---|
| GET | `/portal/config` | **Public.** Portal name, welcome message, support contact, `login_identifiers`, `otp_method`, `password_rules`, `terms_version`/`terms_url`/`privacy_url`, `features`, `dashboard_cards`, `enabled`, `self_registration`. Contains no secrets. |
| POST | `/portal/auth/login` | Takes `{identifier_type, identifier, password}`. Answer **the same 401 whether the identifier or the password is wrong.** Count failures per account. After `max_login_attempts`, lock the account for `lockout_minutes` and return **423** with `locked_until`. Return **403** `account_disabled` when access is disabled, and **429** for per-IP throttling. Record every attempt (success or failure) for the login history. |
| POST | `/portal/auth/logout` | Revokes the current token. |
| GET | `/portal/auth/me` | Returns the `PortalMember` for the token. |
| POST | `/portal/auth/activation/verify` | Takes `{invitation_token}` **or** `{member_number, contact, birthdate}`. Match it to an existing member who is eligible and not yet activated, send a 6-digit OTP by `otp_method`, and return `{challenge_id, sent_to (masked), expires_in, member_first_name}`. When no member matches, return a generic 422 that does not reveal whether the member exists. When `invitation_only` is set, refuse anyone without an invitation token. |
| POST | `/portal/auth/activation/verify-otp` | Takes `{challenge_id, otp}`. Allow at most 5 tries and expire the code in about 5 minutes. Answer 422 for a wrong or expired code. |
| POST | `/portal/auth/activation/complete` | Takes `{challenge_id, password, password_confirmation, accepted_terms_version, electronic_communication_consent}`. The OTP must already be verified. Validate the password against `password_rules`, store the terms version and its timestamp along with the consent, set the status to `active`, and return the login response. |
| POST | `/portal/auth/password/forgot` | Takes `{identifier_type, identifier}`. **Always 200**, and send an OTP only when the account exists, so the response leaks nothing. Return `{challenge_id, sent_to, expires_in}` (use a dummy challenge when nobody matched). |
| POST | `/portal/auth/password/verify-otp` | Same as the activation OTP step. |
| POST | `/portal/auth/password/reset` | Takes `{challenge_id, password, password_confirmation}`. Revoke **all** of the member's tokens and clear any lock. |
| POST | `/portal/auth/password/change` | Authenticated. Takes `{current_password, password, password_confirmation}`. Return 422 when the current password is wrong. Revoke every token except the current one, and set `password_changed_at`. |

## Member data (read-only, token-scoped)

| Method | Path | Logic |
|---|---|---|
| GET | `/portal/dashboard` | Returns `member {member_number, member_since, branch_name, status}`, the `share_capital.total`, `savings {total, available}`, `time_deposits {total, count}` and `loans {outstanding, active_count}` blocks (send each as null when its feature is off), `next_payment {loan_number, amount, due_date}` or null, `pending_requests`, `unread_notifications`, `documents`, `recent_activity[] {id, date, description, amount}` (last 5) and `announcements[] {id, title, published_at}`. |
| GET | `/portal/membership` | Returns the membership type and status, member-since date, branch (name, address, contact, hours), `standing[]` `{label, ok, detail}` (for example dues current or no past-due loans) and `requirements[]` `{label, complete, due_date}`. |
| GET | `/portal/profile` | Returns full_name, member_number, branch_name, birthdate, gender, civil_status, mobile, email, address, occupation, employer, government_id (**masked**, last 4 digits) and beneficiary. |
| GET | `/portal/profile/update-requests` | The member's own requests, newest first: `{id, reference, status (submitted, under_review, approved, rejected or need_info), submitted_at, changes[] {field, current, requested}, response}`. |
| POST | `/portal/profile/update-requests` | Takes `{changes[] {field, requested}, remarks?}`, where `field` is one of address, mobile, email, civil_status, occupation, employer or beneficiary. Snapshot `current` from the member record at submission time and generate a `reference`. **Nothing changes on the member until staff approve.** Returns the request. Answer 422 when the member already has an open request for the same field. |
| DELETE | `/portal/profile/update-requests/{id}` | Withdraws the request. Allowed only on the member's own request while it is `submitted`. |
| GET | `/portal/security/sessions` | The member's active tokens: `{id, device (from User-Agent), ip_address, location, last_active_at, current}`. |
| DELETE | `/portal/security/sessions/{id}` | Revokes one of the member's own tokens. Refuse the current one. |
| POST | `/portal/security/sessions/logout-others` | Revokes every token except the current one. |
| GET | `/portal/security/logins` | The last 20 login attempts: `{id, at, device, ip_address, location, success, reported}`. |
| POST | `/portal/security/logins/{id}/report` | Flags the attempt as "this wasn't me". Set `reported`, notify staff, and write an audit entry. |

## Staff side (staff token)

The permissions are `member_portal:view`, `member_portal:manage` and `member_portal:settings`. **Seed all three for admin and super_admin.** The menu and screens read them from `user.permissions`.

| Method | Path | Perm | Logic |
|---|---|---|---|
| GET | `/portal-admin/settings` | settings | Returns everything in `/portal/config`, plus `invitation_only`, `require_reacceptance`, `session_minutes`, `max_login_attempts`, `lockout_minutes` and `deceased_policy` (disable or read_only). |
| PUT | `/portal-admin/settings` | settings | Saves the same shape. Validate that `login_identifiers` is not empty, that `password_rules.min_length` is at least 8, and the minimums on the session, attempts and lockout values. Write an audit entry. If `require_reacceptance` is set and `terms_version` changed, members must accept the terms again at their next login. |
| GET | `/portal-admin/stats` | view | Returns `total_members`, `eligible`, `activated`, `registered`, `active_this_month`, `never_logged_in`, `locked` and `invitations_pending`, all computed on the server. |
| GET | `/portal-admin/accounts` | view | A paginated list (`meta.total`; `per_page` up to 100) with the filters `search` (name or member number), `status`, `branch_id`, `has_email` and `has_mobile`. Each row has `{borrower_id, member_number, full_name, branch_name, membership_type, email, mobile, status, last_login_at}`. Scope it to the user's branch for branch staff. |
| GET | `/portal-admin/members/{borrower}/access` | view | Returns `{enabled, status (not_invited, invitation_sent, registered, active, locked or disabled), invited_at, registered_at, last_login_at, password_changed_at, disabled_reason, terms_version_accepted, terms_accepted_at}`. |
| PUT | `/portal-admin/members/{borrower}/access` | manage | Takes `{enabled, disabled_reason?}`; the reason is required when disabling. It is one of member_request, membership_terminated, security_concern, deceased, duplicate_account or administrative. Disabling revokes all member tokens. Write an audit entry. |
| POST | `/portal-admin/members/{borrower}/invite` | manage | Sends or re-sends an invitation link (a signed, expiring `invitation_token`) by SMS or email. Answer 422 when the member has neither an email address nor a mobile number. Logs a communication. |
| POST | `/portal-admin/members/{borrower}/unlock` | manage | Clears the lock and the failure counter. Write an audit entry. |
| GET | `/portal-admin/members/{borrower}/communications` | view | The portal messages sent to the member: `{id, at, kind, channel (sms, email or in_app), description}`. |
| POST | `/portal-admin/invitations/bulk` | manage | Takes `{borrower_ids[]}` (up to 100). Returns `{invited, skipped[] {borrower_id, reason}}`. Skip members who have no contact details or are already active. Queue the sending. |
| GET | `/portal-admin/profile-requests?status=` | manage | Every member's change requests, with `borrower_id`, `member_name` and `member_number` added. |
| POST | `/portal-admin/profile-requests/{id}/decision` | manage | Takes `{decision (approve, reject or need_info), response?}`. **Approve writes the requested values to the member record** and keeps a before/after audit entry. Notify the member. |

## Cross-cutting

- Mark a member's portal access as `disabled` (reason `deceased`) when the member is marked deceased, following `deceased_policy`, and when membership is terminated.
- Audit every staff action and every security event on a member account.
- OTP and invitation sends are rate-limited per member and per IP.

## Part 2: member finances (member token, read-only except GCash)

Every route resolves the member from the token. An `{id}` that belongs to another member answers **404**, not 403, so ids cannot be probed. Amounts are `decimal:2` strings or numbers. Each service obeys its `/portal/config` feature switch: when the switch is off, answer 403.

| Method | Path | Feature | Logic |
|---|---|---|---|
| GET | `/portal/loans` | loans | The member's loans, newest first: `{id, loan_number, product_name, status (pending, approved, active, past_due, restructured, paid or written_off), principal, outstanding_balance, past_due_amount, next_due_date, next_due_amount, released_at, maturity_date}`. Use the same balance figures as the staff loan screen and the SOA. |
| GET | `/portal/loans/{id}` | loans | The summary row plus `term, term_unit, frequency, interest_rate, interest_method, total_payable, total_paid, penalty_balance, collaterals[] {id, type, description, appraised_value}` and `co_makers[] {name}`. Send names only, never co-makers' contact details. |
| GET | `/portal/loans/{id}/schedule` | loans | Installment rows `{installment_no, due_date, principal, interest, total_due, amount_paid, balance, status (paid, partial, due, overdue or upcoming)}`, with statuses computed on the server as of today in Manila time. |
| GET | `/portal/loans/{id}/payments` | loans | Posted payments to this loan (the same row shape as `/portal/payments`). Voided payments are excluded. |
| GET | `/portal/loans/{id}/statement-of-account` | statements | A PDF of the SOA, the same document staff print. |
| GET | `/portal/payments?page&per_page&loan_id` | loans | Paginated (`meta.total`; `per_page` up to 100), newest first: `{id, receipt_number, paid_at, amount, loan_id, loan_number, method, principal, interest, penalty, has_receipt}`. |
| GET | `/portal/payments/{id}/receipt` | loans | A PDF of the official receipt. 404 when `has_receipt` is false. |
| POST | `/portal/payments/gcash` | gcash_payments | Takes `{loan_id, amount}`. Accept only an active, past-due or restructured loan, and an amount between 1 and the outstanding balance with at most 2 decimals. Create a pending GCash intent and return `{reference, checkout_url}` (https). **Post nothing to the loan here.** The payment is applied only by the gateway's verified webhook, using the existing GCash posting flow (idempotent on `reference`); then notify the member. |
| GET | `/portal/share-capital` | share_capital | `{subscribed, paid_up, unpaid_subscription, share_count, last_transaction_at}`. |
| GET | `/portal/share-capital/transactions` | share_capital | Ledger rows `{id, date, description, reference, debit, credit, balance}`, newest first, with the running balance from the server. |
| GET | `/portal/savings` | savings | `{id, account_number, product_name, status, balance, available_balance (net of holds), interest_rate, opened_at}`. |
| GET | `/portal/savings/{id}/transactions` | savings | Ledger rows (the same shape as share capital). |
| GET | `/portal/time-deposits` | time_deposits | `{id, certificate_number, principal, interest_rate, term_days, placed_at, maturity_date, maturity_value, status (active, matured, withdrawn or rolled_over)}`. |
| GET | `/portal/time-deposits/{id}/certificate` | time_deposits | A PDF of the certificate. |
| GET | `/portal/statements/download?kind&account_id&from&to` | statements | A PDF. `kind` is consolidated, loan, savings or share_capital, and `account_id` is required for loan and savings and must belong to the member. Reject with 422 when `from` is after `to`, when `to` is in the future, or when the range is longer than 1 year. Log the download in the member's activity. |

## Part 3: requests, loan applications, documents and staff review

Swagger was unreachable when this was written, so the contract is unverified against the backend. The same rules as Part 2 apply: the member is resolved from the token, another member's `{id}` answers **404**, and a service whose `/portal/config` switch is off answers **403**. **No member route posts money**: each one creates a pending record for staff.

| Method | Path | Feature | Logic |
|---|---|---|---|
| GET | `/portal/requests` | (always) | The member's requests, newest first: `{id, reference, type, status, summary, details{}, remarks, response, submitted_at, updated_at, timeline[] {at, status, label}, attachments[] {id, name, url}}`. The timeline must be member-safe, so leave out internal staff notes. |
| POST | `/portal/requests` | per type | Multipart: `type`, `details[key]`, `remarks?` and `attachments[]` (up to 5 files, each 10 MB or less, PDF/JPG/PNG). `type` is one of savings_withdrawal (switches savings + withdrawal_requests), savings_opening (savings), time_deposit_instruction (time_deposits), loan_restructure (loans), document_request (documents), membership_concern, account_closure or other. Validate the `details` per type (see below). The status starts at `submitted`. Notify staff. |
| DELETE | `/portal/requests/{id}` | — | Cancels the request. Allowed only while it is `submitted`; otherwise answer 422. |
| POST | `/portal/requests/{id}/reply` | — | Multipart: `message` and `attachments[]`. Allowed only while it is `need_info`. Moves the request back to `under_review` and adds a timeline entry. |
| GET | `/portal/savings-products` | savings | The products a member may open: `{id, name, description, minimum_deposit, interest_rate, terms_url}`. |
| GET | `/portal/loan-products` | loan_applications | The products offered online: `{id, name, description, min_amount, max_amount, min_term, max_term, term_unit, interest_rate, frequency, requires_income_info, requires_collateral, required_documents[]}`. |
| GET | `/portal/loan-products/{id}/eligibility` | loan_applications | `{eligible, checks[] {label, ok, detail}}`: membership standing, share capital minimum, no past-due loan, and the product's own rules. This is a preview only; the member is told "Final approval is subject to cooperative review." |
| GET | `/portal/loan-applications` | loan_applications | `{id, reference, product_name, amount, term, term_unit, purpose, status (submitted, document_review, credit_assessment, for_approval, approved, for_release, released, rejected or cancelled), submitted_at, loan_id, response, timeline[]}`. Set `loan_id` once the loan exists. |
| POST | `/portal/loan-applications` | loan_applications | Multipart: `product_id, amount, term, purpose`, plus `monthly_income`, `other_income`, `monthly_expenses` and `income_source` when the product requires income information, `collateral_description` and `collateral_value` when it requires collateral, `documents[i][name]` + `documents[i][file]` for every required document, and `declaration_accepted=1`. Re-check eligibility, the product's min/max amount and term, and the required documents (422 on any failure). **Create a normal staff loan application** (the same record as Loans → New Application) with the source `portal`, so it runs through the existing workflow. |
| DELETE | `/portal/loan-applications/{id}` | loan_applications | Cancels the application while it is `submitted`; otherwise answer 422. |
| GET | `/portal/documents` | documents | Only the documents released to the member: `{id, title, category (membership, loans, share_capital, savings, payments or other), reference, issued_at, signing_status (not_required, for_signature, signed, expired or replaced), file_name}`. |
| GET | `/portal/documents/{id}/download` | documents | The file. Log the download. |
| GET | `/portal-admin/requests?page&per_page&status&type&search` | manage | Paginated (`meta.total`; `per_page` up to 100), with `borrower_id`, `member_name` and `member_number` added to each row. Scope it to the user's branch for branch staff. |
| POST | `/portal-admin/requests/{id}/decision` | manage | Takes `{decision (under_review, need_info, approve, reject or complete), response?}`. `response` is **required for need_info and reject**. The allowed moves are: submitted → any decision except complete; under_review or need_info → need_info, approve or reject; approved → complete. Answer 422 on anything else. Add a timeline entry, write an audit entry, and notify the member. |

**`details` keys per request type**
- **savings_withdrawal:** `account_id`, `amount`, `disbursement_method` (gcash, bank or cash_pickup), then `gcash_number`, or `bank_name` + `bank_account_name` + `bank_account_number`. The amount must not exceed `withdrawable`, which is the available balance minus the maintaining balance. **Approve reserves the amount (a hold); complete posts the withdrawal** through the existing savings withdrawal flow.
- **savings_opening:** `product_id`, `initial_deposit` (at least the product's `minimum_deposit`) and `terms_accepted`. Complete opens the account.
- **time_deposit_instruction:** `time_deposit_id` (must be active), `instruction` (renew_principal, renew_with_interest, credit_to_savings or payout), and `savings_account_id` when the instruction is credit_to_savings. It is applied at maturity.
- **loan_restructure:** `loan_id`, `reason` and `requested_arrangement`. Approve hands it to the existing restructure workflow (Loans → Restructure); it never changes the loan by itself.
- **document_request:** `document_type` and `purpose`.
- **membership_concern / other:** `subject` and `message`.
- **account_closure:** `close` (membership or savings), `savings_account_id` when closing savings, and `reason`.

**Savings fields the portal now reads.** `GET /portal/savings` rows gain `maintaining_balance`, `withdrawable` and `pending_withdrawal`. These are optional; when `withdrawable` is missing, the frontend falls back to `available_balance − maintaining_balance`.

## Part 4: engagement (notifications, announcements, help, activity, search, credit score, auto-pay, dividends)

Swagger was unreachable when this was written, so the contract is unverified against the backend. Parts 2 and 3's rules still apply: the member comes from the token, another member's `{id}` answers **404**, and a switched-off feature answers **403**. `GET /portal/config` gains three feature keys, `auto_pay`, `dividends` and `help_desk` (booleans, default on), editable in Settings → Member Portal like the others.

| Method | Path | Feature | Logic |
|---|---|---|---|
| GET | `/portal/credit-score` | credit_score ≠ hidden | `{category, score, max_score, as_of, factors[] {label, impact (positive, negative or neutral), description}}`. **Trim it on the server** to the visibility setting: `category` sends only the category, `score` adds the score, `score_factors` adds the factors. Never send weights, model internals or staff overrides. |
| GET | `/portal/loans/{id}` | loans | Collateral rows gain `reference` and `status`. Do not send internal notes or appraiser remarks. |
| GET | `/portal/auto-pay` | auto_pay | The member's arrangements: `{id, loan_id, loan_number, status (active, paused, pending, cancelled or failed), amount (null = the amount due), schedule, source, next_run, history[] {date, amount, status (success, failed or skipped), note}}`. Changes arrive as a Part 3 request of type **`auto_pay`** (`details`: `action` enable, update or disable, `loan_id`, `savings_account_id` and optional `amount` for enable and update, `reason` for disable); staff approving it sets the arrangement up. |
| GET | `/portal/notifications?page&per_page&category&unread=1` | (always) | Paginated (`meta.total`), newest first: `{id, category, title, body, created_at, read_at, link}`. `link` must be a `/member/...` path or null (the frontend drops anything else). |
| GET | `/portal/notifications/unread-count` | (always) | `{count}`. Polled on every page change, so keep it cheap. |
| POST | `/portal/notifications/{id}/read` and `/portal/notifications/read-all` | (always) | Sets `read_at`. |
| GET / PUT | `/portal/notification-preferences` | (always) | Rows `{category, mandatory, in_app, email, sms, push}`; PUT takes `{preferences: [...]}`. **Security notifications are mandatory**: ignore any attempt to switch them off. Push is not offered yet. |
| GET | `/portal/announcements` and `/portal/announcements/{id}` | (always) | Only the published, unexpired ones whose audience includes this member: `{id, title, body (plain text), published_at, expires_at, pinned}`. |
| GET / POST | `/portal-admin/announcements?page&per_page&status` | manage | Paginated. A row adds `status (draft, scheduled, published or expired), audience (all, branch, member_type or members), branch_ids, member_types, member_numbers, recipients, created_by`. POST and `PUT /{id}` take `{title, body, audience, branch_ids, member_types, member_numbers, publish_at, expires_at, pinned, publish}`. Only the active audience's list is sent. `publish=false` saves a draft. A blank `publish_at` publishes now; otherwise it is **Asia/Manila local time** (`YYYY-MM-DDTHH:mm`), and so is `expires_at`. Reject unknown member numbers with 422, notify the audience when it goes out, and record `recipients`. `DELETE /{id}` removes it. |
| GET | `/portal/share-capital/dividends` | dividends | One row per year: `{year, dividend, patronage_refund, total, status (declared, pending or paid), credited_to (share_capital, savings or cash), paid_at}`. |
| GET | `/portal/help/faqs` | help_desk | `{id, category, question, answer}` (plain text), maintained by staff. |
| GET / POST | `/portal/support-tickets` | help_desk | The member's tickets `{id, reference, category, subject, message, status (submitted, open, in_progress, resolved or closed), created_at, updated_at, attachments[], replies[] {id, author (member or staff), author_name, message, created_at, attachments[]}}`. POST is multipart (`category, subject, message, attachments[]`, with the Part 3 file limits), returns the ticket, and notifies staff. |
| GET | `/portal/support-tickets/{id}` and POST `/{id}/reply` | help_desk | The reply is multipart (`message, attachments[]`). Answer 422 on a closed ticket. A member reply moves a resolved ticket back to open. |
| GET | `/portal-admin/support-tickets?page&per_page&status&search` | manage | Paginated, with `borrower_id, member_name, member_number` and the full thread; branch-scoped. `POST /{id}/reply` takes `{message, status}`, where a message may be blank only when closing. Notify the member. |
| GET | `/portal/activity?page&per_page&kind&from&to` | (always) | Paginated: `{id, kind (loan_payment, savings, share_capital, loan, request or other), description, amount, date}`, covering only the member's own records. `from`/`to` are `YYYY-MM-DD`. **No audit internals** (no staff names, IPs or record ids). |
| GET | `/portal/search?q` | (always) | `q` has at least 2 characters (422 below that). Search **only this member's own records**: `[{kind (loan, transaction, document, receipt, statement or request), id, title, subtitle, date}]`, capped at about 50. |
