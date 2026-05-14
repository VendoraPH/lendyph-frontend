// src/services/registration.service.ts
import { api } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/config/api-endpoints";

export type RegistrationStatus = "pending" | "active" | "inactive" | "blacklisted";

export interface RegistrationPayload {
  first_name: string;
  middle_name: string;
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
  status?: string;
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
  status: RegistrationStatus;
  rejection_reason?: string | null;
  submitted_at: string;
}

export interface RegistrationListResponse {
  data: Registration[];
  total: number;
  per_page: number;
  current_page: number;
}

export const registrationService = {
  submit: (payload: RegistrationPayload) =>
    api.post<{ id: number }>(API_ENDPOINTS.REGISTRATIONS.SUBMIT, payload),

  list: (params?: { status?: RegistrationStatus; page?: number; per_page?: number }) =>
    api.get<RegistrationListResponse>(API_ENDPOINTS.REGISTRATIONS.LIST, { params }),

  get: (id: number) =>
    api.get<Registration>(API_ENDPOINTS.REGISTRATIONS.DETAIL(id)),

  update: (id: number, data: Partial<RegistrationPayload>) =>
    api.put<Registration>(API_ENDPOINTS.REGISTRATIONS.UPDATE(id), data),

  approve: (id: number) =>
    api.patch<void>(API_ENDPOINTS.REGISTRATIONS.APPROVE(id)),

  reject: (id: number) =>
    api.delete<void>(API_ENDPOINTS.REGISTRATIONS.REJECT(id)),
};
