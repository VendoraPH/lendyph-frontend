const getEnvVar = (key: string, defaultValue?: string): string => {
  const value = process.env[key] || defaultValue;
  if (!value) {
    console.warn(`Missing environment variable: ${key}`);
  }
  return value || "";
};

/**
 * Truthiness rule for every boolean env var: only an explicit "true" / "1" turns
 * a flag on. An unset var falls back to `defaultValue`; any other value
 * (including "") is off.
 * Takes the value rather than the key so callers that must reference
 * `process.env.SOME_VAR` literally (see `features.binhsAmortization`) can share it.
 */
const parseBoolEnvValue = (
  value: string | undefined,
  defaultValue = false
): boolean => {
  if (value === undefined) return defaultValue;
  return value === "true" || value === "1";
};

const getBoolEnvVar = (key: string, defaultValue = false): boolean =>
  parseBoolEnvValue(process.env[key], defaultValue);

const getNumberEnvVar = (key: string, defaultValue: number): number => {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  const num = parseInt(value, 10);
  return isNaN(num) ? defaultValue : num;
};

export const env = {
  app: {
    name: getEnvVar("NEXT_PUBLIC_APP_NAME", "Lendy.PH"),
    url: getEnvVar("NEXT_PUBLIC_APP_URL", "http://localhost:3000"),
    env: getEnvVar("NEXT_PUBLIC_APP_ENV", "development"),
    isDevelopment:
      getEnvVar("NEXT_PUBLIC_APP_ENV", "development") === "development",
    isProduction:
      getEnvVar("NEXT_PUBLIC_APP_ENV", "development") === "production",
  },
  api: {
    baseUrl: getEnvVar("NEXT_PUBLIC_API_URL", "http://localhost:8000/api"),
    timeout: getNumberEnvVar("NEXT_PUBLIC_API_TIMEOUT", 30000),
  },
  auth: {
    tokenKey: getEnvVar("NEXT_PUBLIC_AUTH_TOKEN_KEY", "lendy_access_token"),
    refreshTokenKey: getEnvVar(
      "NEXT_PUBLIC_REFRESH_TOKEN_KEY",
      "lendy_refresh_token"
    ),
    sessionTimeout: getNumberEnvVar("NEXT_PUBLIC_SESSION_TIMEOUT", 30),
  },
  storage: {
    url: getEnvVar("NEXT_PUBLIC_STORAGE_URL", "http://localhost:8000/storage"),
  },
  business: {
    currency: getEnvVar("NEXT_PUBLIC_CURRENCY", "PHP"),
    currencySymbol: getEnvVar("NEXT_PUBLIC_CURRENCY_SYMBOL", "₱"),
    taxRate: getNumberEnvVar("NEXT_PUBLIC_TAX_RATE", 12),
    timezone: getEnvVar("NEXT_PUBLIC_TIMEZONE", "Asia/Manila"),
  },
  features: {
    analytics: getBoolEnvVar("NEXT_PUBLIC_ENABLE_ANALYTICS", false),
    // The BINHS amortization calculator is specific to the binhs-coop client.
    // lendyph is single-tenant-per-deployment and every instance builds
    // separately, so this build-time flag keeps the page live on
    // binhs.lendyph.com while hiding it from the shared product — no client name
    // hardcoded into shared code.
    //
    // Referenced literally on purpose: Next.js inlines `NEXT_PUBLIC_*` into the
    // browser bundle only for static `process.env.X` lookups. A dynamic
    // `process.env[key]` (as `getBoolEnvVar` does) is NOT inlined and would read
    // as undefined client-side.
    binhsAmortization: parseBoolEnvValue(
      process.env.NEXT_PUBLIC_ENABLE_BINHS_AMORTIZATION
    ),
  },
  debug: {
    enabled: getBoolEnvVar("NEXT_PUBLIC_DEBUG", false),
    showErrorDetails: getBoolEnvVar("NEXT_PUBLIC_SHOW_ERROR_DETAILS", false),
    mockApi: getBoolEnvVar("NEXT_PUBLIC_MOCK_API", false),
  },
};
