import { api } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/config/api-endpoints";

export const settingsService = {
  profile: () =>
    api.get(API_ENDPOINTS.SETTINGS.PROFILE),

  updateProfile: (data: Record<string, unknown>) =>
    api.put(API_ENDPOINTS.SETTINGS.PROFILE, data),

  business: () =>
    api.get(API_ENDPOINTS.SETTINGS.BUSINESS),

  updateBusiness: (data: Record<string, unknown>) =>
    api.put(API_ENDPOINTS.SETTINGS.BUSINESS, data),

  loanProducts: () =>
    api.get(API_ENDPOINTS.SETTINGS.LOAN_PRODUCTS),

  interestRates: () =>
    api.get(API_ENDPOINTS.SETTINGS.INTEREST_RATES),
};
