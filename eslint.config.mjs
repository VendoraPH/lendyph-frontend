import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // Advisory perf rule (react.dev "you might not need an effect"). The app
      // consistently kicks off fetches with a synchronous setLoading(true) at the
      // top of an effect across ~9 call sites; treat as a warning rather than a
      // build-breaker so lint-in-CI can gate real errors without a mass refactor.
      "react-hooks/set-state-in-effect": "warn",

      // The app runs on Philippine Standard Time (UTC+8) and toISOString()
      // converts to UTC first, so between 00:00 and 07:59 Manila it reports
      // YESTERDAY. Slicing a calendar date out of it booked payments, pledges
      // and audit filters a day early — twice, because the first fix landed in
      // one file and never spread. This is an error, not a warning: the blast
      // radius is the ledger.
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CallExpression[callee.property.name='split'][callee.object.callee.property.name='toISOString']",
          message:
            "toISOString() is UTC — splitting a date out of it yields yesterday before 08:00 in Manila. Use formatDateISO(date) or todayISO() from @/lib/format.",
        },
        {
          selector:
            "CallExpression[callee.property.name='slice'][callee.object.callee.property.name='toISOString']",
          message:
            "toISOString() is UTC — slicing a date out of it yields yesterday before 08:00 in Manila. Use formatDateISO(date) or todayISO() from @/lib/format.",
        },
      ],
    },
  },
]);

export default eslintConfig;
