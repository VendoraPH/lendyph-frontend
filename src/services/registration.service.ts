// src/services/registration.service.ts
import { api } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import type { PaginatedResponse } from "@/types";

/**
 * Every status `/borrowers` can hold, mirroring the API's own enum
 * (BorrowerResource: `active | inactive | blacklisted | pending | rejected`).
 *
 * `rejected` was missing here, and that single omission is what made a rejected
 * application unreachable: `reject()` writes the status happily, but
 * `useRegistrations({ status: "rejected" })` would not type-check, so no screen
 * could ever ask for one. Keep this list exhaustive against the API enum — it
 * is the type every registration query is keyed on.
 */
export type RegistrationStatus =
  | "pending"
  | "active"
  | "inactive"
  | "blacklisted"
  | "rejected";

export interface RegistrationPayload {
  // Required identity
  first_name: string;
  // Optional — many Filipino applicants don't have a middle name on file.
  middle_name?: string;
  last_name: string;
  suffix?: string;
  birthdate: string;
  gender: string;
  civil_status: string;
  contact_number: string;
  email?: string;
  address: string;
  barangay?: string;
  city: string;
  province: string;

  // Borrower-parity additions
  // Optional from the public side: when the public /branches endpoint is
  // unavailable, the applicant submits without a branch and an admin
  // assigns one during review.
  branch_id?: number;
  employer_or_business?: string;
  // Employment start date (YYYY-MM-DD). Backend rejects future dates.
  date_hired?: string;
  monthly_income?: number;
  pledge_amount?: number;

  // Spouse (only when civil_status === "married")
  spouse_first_name?: string;
  spouse_middle_name?: string;
  spouse_last_name?: string;
  spouse_contact_number?: string;
  spouse_occupation?: string;

  status?: RegistrationStatus;

  // Client-generated idempotency key (v4 UUID) for the PUBLIC form only; see
  // src/lib/registration-key.ts. Resending the same key inside the 15-minute
  // submission window returns the borrower the first attempt created, instead
  // of rejecting the retry as a duplicate — which is what a lost or timed-out
  // response used to cost the applicant. Optional: operator creates send
  // nothing and the backend ignores it for authenticated callers.
  registration_uuid?: string;
}

export interface SubmitRegistrationResponse {
  id: number;
  // Short-lived token returned by the backend so the public client can
  // attach the subsequent photo / valid-id uploads without an auth session.
  // See spec: docs/superpowers/specs/2026-05-16-public-registration-borrower-parity-design.md
  submission_token?: string;
  expires_at?: string;
}

export interface Registration {
  id: number;
  first_name: string;
  middle_name: string;
  last_name: string;
  suffix?: string | null;
  birthdate: string;
  gender: string;
  civil_status: string;
  contact_number: string;
  email?: string | null;
  address: string;
  barangay?: string | null;
  city: string;
  province: string;
  branch_id?: number | null;
  employer_or_business?: string | null;
  date_hired?: string | null;
  monthly_income?: number | null;
  pledge_amount?: number | null;
  spouse_first_name?: string | null;
  spouse_middle_name?: string | null;
  spouse_last_name?: string | null;
  spouse_contact_number?: string | null;
  spouse_occupation?: string | null;
  // Surfaced from /borrowers/{id} so the admin can see the applicant's
  // uploaded headshot directly on the review page. The shared /borrowers list
  // returns the headshot as the legacy `photo` (absolute URL) field instead, so
  // both are declared and consumers fall back from one to the other.
  photo_url?: string | null;
  photo?: string | null;
  status: RegistrationStatus;

  // ── Review outcome (BorrowerResource) ──
  // Only populated once an admin has decided. `rejection_reason` was declared
  // long before anything rendered it; `rejected_at` / `rejected_by` were not
  // declared at all, so "who rejected this, and when" was unanswerable in the
  // UI even though the API has been sending both since the reject endpoint
  // shipped.
  rejection_reason?: string | null;
  rejected_at?: string | null;
  /**
   * The reviewer's *user id*, not their name — BorrowerResource returns the raw
   * FK (`'rejected_by' => $this->rejected_by`) and does not load the
   * `rejectedByUser` relation the model defines. Resolving it needs
   * `users:view`, which a `borrowers:approve` reviewer does not necessarily
   * hold, so the UI must be able to render from the id alone.
   */
  rejected_by?: number | null;
  /**
   * Present only once the API starts including the reviewer relation, the way
   * LoanResource already does for `rejected_by_user`. Declared now so the UI
   * upgrades from "Reviewer #7" to a real name with no frontend change.
   */
  rejected_by_user?: { id: number; full_name?: string; name?: string } | null;
  approved_at?: string | null;
  approved_by?: number | null;

  submitted_at: string;
}

// The /borrowers/{id}/valid-ids endpoint returns one grouped row per ID with
// front/back URLs (same shape the borrower documents tab consumes) — NOT one
// row per side. Keep this aligned with BorrowerValidId.
export interface RegistrationValidId {
  id: number;
  type: string;
  custom_type_name?: string | null;
  id_number?: string | null;
  front_url?: string | null;
  back_url?: string | null;
  created_at?: string;
}

// `/borrowers` answers with a raw Laravel paginator, so the row count lives at
// `meta.total` — not at the top level. The old flat shape declared here meant
// every consumer's `res.total` was `undefined` and silently fell back to the
// length of the current page.
export type RegistrationListResponse = PaginatedResponse<Registration>;

// Header recognised by the backend when the caller is an unauthenticated
// public registrant uploading media tied to the borrower row they just
// created. Token is opaque and short-lived (~15 min). The axios request
// interceptor also keys off this header to avoid attaching a stale
// admin Bearer token from localStorage.
const SUBMISSION_TOKEN_HEADER = "X-Submission-Token";

export const registrationService = {
  /**
   * Create the applicant's borrower row.
   *
   * Send `registration_uuid` from the public form: the endpoint treats a repeat
   * of the same key inside the submission window as the same submission and
   * replays the original response (row + a fresh submission token). Without it
   * a retry after a lost response creates a second, orphaned record.
   *
   * A 422 whose `errors` name `registration_uuid` means the key is spent, not
   * that the applicant is a duplicate — the caller must mint a new one before
   * retrying (see isStaleRegistrationKeyError).
   */
  submit: (payload: RegistrationPayload) =>
    api.post<SubmitRegistrationResponse>(API_ENDPOINTS.REGISTRATIONS.SUBMIT, payload),

  uploadPhoto: (id: number, formData: FormData, submissionToken?: string) =>
    api.upload(
      API_ENDPOINTS.BORROWERS.UPLOAD_PHOTO(id),
      formData,
      submissionToken
        ? { headers: { [SUBMISSION_TOKEN_HEADER]: submissionToken } }
        : undefined
    ),

  uploadValidId: (id: number, formData: FormData, submissionToken?: string) =>
    api.upload(
      API_ENDPOINTS.BORROWERS.UPLOAD_VALID_ID(id),
      formData,
      submissionToken
        ? { headers: { [SUBMISSION_TOKEN_HEADER]: submissionToken } }
        : undefined
    ),

  // `getRaw`, not `get`: the endpoint returns the paginator itself rather than
  // the `{ success, data, message }` envelope, and `api.get` would unwrap away
  // the `meta` this list needs for its true total.
  list: (params?: { status?: RegistrationStatus; page?: number; per_page?: number }) =>
    api.getRaw<RegistrationListResponse>(API_ENDPOINTS.REGISTRATIONS.LIST, { params }),

  get: (id: number) =>
    api.get<Registration>(API_ENDPOINTS.REGISTRATIONS.DETAIL(id)),

  listValidIds: (id: number) =>
    api.get<RegistrationValidId[]>(API_ENDPOINTS.BORROWERS.LIST_VALID_IDS(id)),

  deleteValidId: (id: number, validIdId: number) =>
    api.delete(API_ENDPOINTS.BORROWERS.DELETE_VALID_ID(id, validIdId)),

  update: (id: number, data: Partial<RegistrationPayload>) =>
    api.put<Registration>(API_ENDPOINTS.REGISTRATIONS.UPDATE(id), data),

  /**
   * Approve a pending registration. The endpoint enforces the
   * `borrowers:approve` permission, that the applicant is still `pending`, and
   * that at least one valid ID is on file — then stamps approved_by/approved_at.
   * Rejects with 422 (`errors.status` / `errors.valid_id`) when a gate fails, so
   * callers must surface the server message rather than generic copy.
   */
  approve: (id: number) =>
    api.patch<Registration>(API_ENDPOINTS.REGISTRATIONS.APPROVE(id)),

  /**
   * Soft-reject a pending registration: sets status to `rejected` and records
   * rejection_reason/rejected_by/rejected_at, keeping the applicant on file.
   * `reason` is required by RejectBorrowerRequest (string, max 1000).
   */
  reject: (id: number, data: { reason: string }) =>
    api.patch<Registration>(API_ENDPOINTS.REGISTRATIONS.REJECT(id), data),
};
