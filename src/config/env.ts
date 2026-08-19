/**
 * Vars whose default is a *local development* value, not a universal one.
 *
 * Every deployment must set these explicitly, because falling back is worse
 * than failing: an unset NEXT_PUBLIC_API_URL does not produce an obvious blank,
 * it produces a build that quietly points at localhost. NEXT_PUBLIC_* is inlined
 * at build time, so that wrong value is baked into the bundle, the deploy goes
 * green, and only that one tenant breaks — at runtime, in front of a client.
 *
 * Vars with a genuinely universal default (currency, timezone, token keys)
 * are deliberately absent: they are the same on every instance.
 */
const REQUIRED_IN_PRODUCTION = [
  "NEXT_PUBLIC_API_URL",
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_APP_ENV",
  "NEXT_PUBLIC_STORAGE_URL",
] as const;

/**
 * Only fail during a production *build* or SSR — never in the browser.
 *
 * By the time code runs in a browser the value is already inlined, so if it were
 * missing the build would have failed here first. Throwing client-side could
 * only ever white-screen an app that is otherwise fine.
 */
const shouldEnforce = (): boolean =>
  typeof window === "undefined" && process.env.NODE_ENV === "production";

const getEnvVar = (key: string, defaultValue?: string): string => {
  const raw = process.env[key];

  if (
    !raw &&
    shouldEnforce() &&
    REQUIRED_IN_PRODUCTION.includes(key as never)
  ) {
    throw new Error(
      `${key} is not set. This deployment would fall back to "${defaultValue}", ` +
        `which is a local development value — set it in .env before building. ` +
        `NEXT_PUBLIC_* is inlined at build time, so editing .env after the build does nothing.`,
    );
  }

  const value = raw || defaultValue;
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
  defaultValue = false,
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
      "lendy_refresh_token",
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
      process.env.NEXT_PUBLIC_ENABLE_BINHS_AMORTIZATION,
    ),
  },
  debug: {
    enabled: getBoolEnvVar("NEXT_PUBLIC_DEBUG", false),
    showErrorDetails: getBoolEnvVar("NEXT_PUBLIC_SHOW_ERROR_DETAILS", false),
    mockApi: getBoolEnvVar("NEXT_PUBLIC_MOCK_API", false),
  },
};
