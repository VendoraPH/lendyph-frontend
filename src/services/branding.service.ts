import { api } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/config/api-endpoints";

// Single global branding record (single-tenant-per-deployment). `logo_url` is
// null when no custom logo has been uploaded yet — consumers fall back to the
// bundled default asset in that case.
export interface BrandingSettings {
  logo_url: string | null;
}

export interface BrandingLogoMutationResponse {
  logo_url: string | null;
  message: string;
}

export const brandingService = {
  // Unauthenticated read for the public register/login pages and the app
  // shell logo. Mirrors branchService.publicList — slim, no auth required.
  getPublic: () => api.get<BrandingSettings>(API_ENDPOINTS.BRANDING.PUBLIC),

  get: () => api.get<BrandingSettings>(API_ENDPOINTS.SETTINGS.BRANDING),

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
