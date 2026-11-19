import axios, { type AxiosRequestConfig } from "axios";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import { env } from "@/config/env";
import { API_BASE_URL } from "@/lib/axios-client";
import type {
  ApplicationDocument,
  ApplicationDraft,
  ApplicationSession,
  ConsentAcceptance,
  LoanEstimate,
  OtpRequestResult,
  PublicApplicationPortal,
  PublicApplicationState,
  PublicTrackingResult,
  SubmitResult,
} from "@/types/loan-origination";

const P = API_ENDPOINTS.PUBLIC_APPLY;
export const APPLICATION_SESSION_HEADER = "X-Application-Session";

/**
 * Its own axios instance, not the staff client: an applicant has no Lendy
 * account, and a staff member opening a link in the same browser must not
 * send their bearer token, nor have a 401 here end their staff session.
 */
const publicClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: env.api.timeout,
  headers: { "Content-Type": "application/json", Accept: "application/json" },
});

interface Envelope<T> {
  data: T;
}

async function get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  return (await publicClient.get<Envelope<T>>(url, config)).data.data;
}

async function post<T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> {
  return (await publicClient.post<Envelope<T>>(url, body, config)).data.data;
}

function session(sessionToken: string): AxiosRequestConfig {
  return { headers: { [APPLICATION_SESSION_HEADER]: sessionToken } };
}

/** Why a code is asked for: a new application, resuming a draft, or tracking one. */
export type OtpPurpose = "apply" | "resume" | "track";

export interface OtpTarget {
  channel: "sms" | "email";
  mobile?: string;
  email?: string;
  purpose: OtpPurpose;
  /** Tracking also names the application; never enough on its own. */
  reference_number?: string;
}

export const publicApplicationService = {
  portal: (token: string) => get<PublicApplicationPortal>(P.PORTAL(token)),

  /** Throttled by the server; a 429 says when to try again. */
  requestOtp: (token: string, target: OtpTarget) => post<OtpRequestResult>(P.OTP_REQUEST(token), target),
  verifyOtp: (token: string, target: OtpTarget, code: string) =>
    post<ApplicationSession>(P.OTP_VERIFY(token), { ...target, code }),

  getDraft: (token: string, sessionToken: string) =>
    get<PublicApplicationState>(P.DRAFT(token), session(sessionToken)),
  saveDraft: (token: string, sessionToken: string, draft: ApplicationDraft, lastStep: string) =>
    publicClient
      .put<Envelope<PublicApplicationState>>(
        P.DRAFT(token),
        { draft, last_completed_step: lastStep },
        session(sessionToken),
      )
      .then((r) => r.data.data),

  /** Runs the product's own amortization engine on the server. */
  estimate: (
    token: string,
    sessionToken: string,
    data: { loan_product_id: number; amount: number; term: number; frequency: string | null },
    signal?: AbortSignal,
  ) => post<LoanEstimate>(P.ESTIMATE(token), data, { ...session(sessionToken), signal }),

  uploadDocument: (
    token: string,
    sessionToken: string,
    type: string,
    file: File,
    onProgress?: (percent: number) => void,
  ) => {
    const form = new FormData();
    form.append("type", type);
    form.append("file", file);
    return publicClient
      .post<Envelope<ApplicationDocument>>(P.DOCUMENTS(token), form, {
        headers: { [APPLICATION_SESSION_HEADER]: sessionToken, "Content-Type": "multipart/form-data" },
        onUploadProgress: (e) => {
          if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100));
        },
      })
      .then((r) => r.data.data);
  },
  removeDocument: (token: string, sessionToken: string, docId: number) =>
    publicClient.delete(P.DOCUMENT(token, docId), session(sessionToken)).then(() => undefined),

  /** Idempotent per session: a repeated submit returns the first reference. */
  submit: (token: string, sessionToken: string, consent: ConsentAcceptance) =>
    post<SubmitResult>(P.SUBMIT(token), consent, session(sessionToken)),

  track: (token: string, sessionToken: string) =>
    get<PublicTrackingResult>(P.TRACK(token), session(sessionToken)),
};

/** The server's message on a failed request, or `fallback`. */
export function publicErrorMessage(err: unknown, fallback: string): string {
  const res = (err as { response?: { status?: number; data?: { message?: string } } })?.response;
  if (res?.status === 404 || res?.status === 501) {
    return "Online applications are not available yet. Please contact the office.";
  }
  if (res?.status === 429) return res.data?.message ?? "Too many attempts. Please wait a moment and try again.";
  return res?.data?.message ?? fallback;
}
