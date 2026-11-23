import axios, { type AxiosRequestConfig } from "axios";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import { env } from "@/config/env";
import { API_BASE_URL } from "@/lib/axios-client";
import type { ApplicationDraft } from "@/types/loan-origination";
import type {
  ApplicantSession,
  CodeSent,
  Consents,
  EstimateRequest,
  OtpTarget,
  PublicApplicationState,
  PublicDocument,
  PublicEstimate,
  PublicPortal,
  Submitted,
  Tracking,
} from "@/types/public-application";

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

/**
 * The public application on LO-B2's `/api/public-apply/{token}` routes. Codes
 * go by text message only. Every refusal comes back in the server's words.
 */
export const publicApplicationService = {
  portal: (token: string) => get<PublicPortal>(P.PORTAL(token)),

  /** Throttled by the server: one a minute and five an hour per mobile. */
  requestCode: (token: string, target: OtpTarget) => post<CodeSent>(P.OTP_REQUEST(token), { channel: "sms", ...target }),

  /** A new application also acknowledges the privacy notice it was shown, by version. */
  verifyCode: (token: string, target: OtpTarget, code: string, privacyNoticeVersion?: string) =>
    post<ApplicantSession>(P.OTP_VERIFY(token), {
      channel: "sms",
      ...target,
      code,
      ...(privacyNoticeVersion ? { privacy_notice_version: privacyNoticeVersion } : {}),
    }),

  getDraft: (token: string, sessionToken: string) => get<PublicApplicationState>(P.DRAFT(token), session(sessionToken)),

  /** Autosave. The server works out the completion and the last completed step itself. */
  saveDraft: (token: string, sessionToken: string, draft: ApplicationDraft) =>
    publicClient
      .put<Envelope<PublicApplicationState>>(P.DRAFT(token), { draft }, session(sessionToken))
      .then((r) => r.data.data),

  /** The loan form's own preview, worked out on the server. Saves nothing. */
  estimate: (token: string, sessionToken: string, request: EstimateRequest, signal?: AbortSignal) =>
    post<PublicEstimate>(P.ESTIMATE(token), request, { ...session(sessionToken), signal }),

  uploadDocument: (
    token: string,
    sessionToken: string,
    type: string,
    file: File,
    onProgress?: (sent: number, size: number | undefined) => void,
  ) => {
    const form = new FormData();
    form.append("type", type);
    form.append("file", file);
    return publicClient
      .post<Envelope<PublicDocument>>(P.DOCUMENTS(token), form, {
        headers: { [APPLICATION_SESSION_HEADER]: sessionToken, "Content-Type": "multipart/form-data" },
        onUploadProgress: (event) => onProgress?.(event.loaded, event.total),
      })
      .then((r) => r.data.data);
  },

  /** By the document's public id, while the draft is open. */
  removeDocument: (token: string, sessionToken: string, documentId: string) =>
    publicClient.delete(P.DOCUMENT(token, documentId), session(sessionToken)).then(() => undefined),

  /** Idempotent: a retried submit answers the same reference. */
  submit: (token: string, sessionToken: string, consents: Consents) =>
    post<Submitted>(P.SUBMIT(token), consents, session(sessionToken)),

  /**
   * Ends the session on the server. It always works in the browser: whatever
   * the server answers (an ended session, a closed link, no reply), it resolves.
   */
  logout: (token: string, sessionToken: string) =>
    publicClient.post(P.LOGOUT(token), null, session(sessionToken)).then(
      () => undefined,
      () => undefined,
    ),

  track: (token: string, sessionToken: string) => get<Tracking>(P.TRACK(token), session(sessionToken)),
};
