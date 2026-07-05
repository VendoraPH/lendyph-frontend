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
    },
  },
]);

export default eslintConfig;
