// src/services/registration.service.ts
import { api } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/config/api-endpoints";

export type RegistrationStatus = "pending" | "active" | "inactive" | "blacklisted";

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
  monthly_income?: number;
  pledge_amount?: number;

  // Spouse (only when civil_status === "married")
  spouse_first_name?: string;
  spouse_middle_name?: string;
  spouse_last_name?: string;
  spouse_contact_number?: string;
  spouse_occupation?: string;

  status?: RegistrationStatus;
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
  monthly_income?: number | null;
  pledge_amount?: number | null;
  spouse_first_name?: string | null;
  spouse_middle_name?: string | null;
  spouse_last_name?: string | null;
  spouse_contact_number?: string | null;
  spouse_occupation?: string | null;
  // Surfaced from /borrowers/{id} so the admin can see the applicant's
  // uploaded headshot directly on the review page.
  photo_url?: string | null;
  status: RegistrationStatus;
  rejection_reason?: string | null;
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

export interface RegistrationListResponse {
  data: Registration[];
  total: number;
  per_page: number;
  current_page: number;
}

// Header recognised by the backend when the caller is an unauthenticated
// public registrant uploading media tied to the borrower row they just
// created. Token is opaque and short-lived (~15 min). The axios request
// interceptor also keys off this header to avoid attaching a stale
// admin Bearer token from localStorage.
const SUBMISSION_TOKEN_HEADER = "X-Submission-Token";

export const registrationService = {
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

  list: (params?: { status?: RegistrationStatus; page?: number; per_page?: number }) =>
    api.get<RegistrationListResponse>(API_ENDPOINTS.REGISTRATIONS.LIST, { params }),

  get: (id: number) =>
    api.get<Registration>(API_ENDPOINTS.REGISTRATIONS.DETAIL(id)),

  listValidIds: (id: number) =>
    api.get<RegistrationValidId[]>(API_ENDPOINTS.BORROWERS.LIST_VALID_IDS(id)),

  update: (id: number, data: Partial<RegistrationPayload>) =>
    api.put<Registration>(API_ENDPOINTS.REGISTRATIONS.UPDATE(id), data),

  approve: (id: number) =>
    api.patch<void>(API_ENDPOINTS.REGISTRATIONS.APPROVE(id)),

  reject: (id: number) =>
    api.delete<void>(API_ENDPOINTS.REGISTRATIONS.REJECT(id)),
};
