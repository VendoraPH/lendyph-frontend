import { api } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/config/api-endpoints";

// Single global branding record (single-tenant-per-deployment). Every field is
// nullable: `logo_url` is null until a custom logo is uploaded, and the three
// organization fields are null until someone fills them in on the branding
// settings page.
//
// They are declared optional as well as nullable on purpose. A deployment whose
// API predates the organization-details migration simply omits the keys, and a
// consumer that reads `?? null` must keep working there rather than trusting a
// field the server never sent.
export interface BrandingSettings {
  logo_url: string | null;
  organization_name?: string | null;
  organization_address?: string | null;
  organization_contact?: string | null;
}

/**
 * Partial by design — the API writes only the keys it receives, so sending one
 * field leaves the other two untouched.
 */
export interface BrandingUpdatePayload {
  organization_name?: string | null;
  organization_address?: string | null;
  organization_contact?: string | null;
}

export interface BrandingLogoMutationResponse {
  logo_url: string | null;
  message: string;
}

export const brandingService = {
  // Unauthenticated read for the public register/login pages and the app
  // shell logo. Mirrors branchService.publicList — slim, no auth required.
  //
  // The organization name rides along here rather than on the authenticated
  // read so report and printable letterheads resolve it without a session.
  getPublic: () => api.get<BrandingSettings>(API_ENDPOINTS.BRANDING.PUBLIC),

  get: () => api.get<BrandingSettings>(API_ENDPOINTS.SETTINGS.BRANDING),

  // Organization identity only. The logo has its own multipart endpoints below
  // because a file upload cannot ride in a JSON body.
  update: (payload: BrandingUpdatePayload) =>
    api.put<BrandingSettings>(API_ENDPOINTS.SETTINGS.BRANDING, payload),

  // Multipart upload — field name `logo`, image ≤5MB (enforced server-side;
  // the settings page also pre-validates + compresses before calling this).
  uploadLogo: (file: File) => {
    const formData = new FormData();
    formData.append("logo", file);
    return api.upload<BrandingLogoMutationResponse>(
      API_ENDPOINTS.SETTINGS.BRANDING_LOGO,
      formData
    );
  },

  deleteLogo: () =>
    api.delete<BrandingLogoMutationResponse>(API_ENDPOINTS.SETTINGS.BRANDING_LOGO),
};
