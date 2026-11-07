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
