import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * Guards against "the caller treats one page as the whole dataset".
 *
 * Every list endpoint in this API paginates with `min(per_page, 100)`. The
 * clamp is silent — not a 422, not a warning, just fewer rows, in a response
 * whose shape is indistinguishable from a complete one. So a screen that asks
 * for 9999 and renders `res.data` shows the first 100 rows and looks finished.
 *
 * Types cannot catch this. `api.get` and `api.getRaw` share a return type, so a
 * truncated page and a whole dataset are the same type to the compiler; that is
 * exactly why five of these were found in a single audit and none of them had
 * ever failed a build. A lint rule is the only thing in this repo that sees the
 * literal.
 *
 * These live in a local plugin rather than as two more `no-restricted-syntax`
 * selectors on purpose: severity in ESLint is per-RULE, not per-selector.
 * Folding them into `no-restricted-syntax` would have chained them to the
 * `toISOString` guard below, so exempting a legacy file from one would have
 * silently downgraded the other — and that one is the guard that worked.
 */
const listCalls = {
  rules: {
    /**
     * `per_page` above the server's own ceiling. Always a bug: the number is
     * not what you get back, and the response will not tell you.
     */
    "no-oversized-per-page": {
      meta: {
        type: "problem",
        docs: {
          description:
            "Disallow per_page literals above the server's clamp of 100.",
        },
        schema: [],
        messages: {
          oversized:
            "`per_page: {{value}}` is clamped to 100 by the server, so this reads the first 100 rows and cannot tell you it did. If you need one page, ask for at most MAX_PER_PAGE (100). If you need every row, drain it with fetchAllPages() from @/lib/paginate.",
        },
      },
      create(context) {
        const report = (node) =>
          context.report({
            node,
            messageId: "oversized",
            data: { value: String(node.value.value) },
          });
        return {
          "Property[key.name='per_page'][value.value>100]": report,
          "Property[key.value='per_page'][value.value>100]": report,
        };
      },
    },

    /**
     * A bare call to a SINGLE-PAGE list method — no `per_page`, no `page`, no
     * filter. Whatever the endpoint's default page size is (15), that is what
     * the caller gets, and every one of these was written expecting the lot.
     *
     * Matched by suffix: `list`, `ledgerList`, `pledgeList`, `publicList` — any
     * name ending in "list". Drains are excluded, and excluded for free, because
     * this codebase names them `listAll` / `ledgerListAll` / `pledgeListAll`,
     * which end in "All" instead. That is not a coincidence to lean on lightly:
     * all five drains return `Promise<DrainResult<T>>`, and each one documents
     * that "`page` and `per_page` are set by the drain — passing them in
     * `params` has no effect". A bare `listAll()` is therefore not merely
     * acceptable, it is the ONLY correct way to call one; the rule previously
     * warned on three of them and told the author to pass arguments that the
     * function explicitly ignores. Advice that is wrong when followed is worse
     * than no rule, because it teaches people to skim past the real hits.
     *
     * The convention is load-bearing and was earned: `repaymentService.listAll`
     * used to be a single `api.get` wearing the drain's name, callers passed
     * `per_page: 100`/`200` and believed it, and payment #101 was unreachable on
     * two screens. It was renamed to `listPage` rather than patched, "because
     * the name was the bug". `listPage` is deliberately not matched here — it
     * ends in "Page" and says exactly what it hands back.
     *
     * Advisory rather than fatal: several hits are genuinely small config
     * resources (roles, fees, branches), so this flags the shape and leaves the
     * judgement to a human.
     */
    "no-unparameterised-list": {
      meta: {
        type: "suggestion",
        docs: {
          description:
            "Flag service list() calls made with no pagination arguments.",
        },
        schema: [],
        messages: {
          unparameterised:
            "`{{call}}()` takes no arguments, so it returns the endpoint's DEFAULT page (15 rows) — not the whole list. Pass an explicit `{ per_page: MAX_PER_PAGE }` for one page, or drain every page with fetchAllPages() from @/lib/paginate. By convention a drain lives on the service as an `…All` sibling returning DrainResult — but only five exist today, so check before reaching for one.",
        },
      },
      create(context) {
        return {
          "CallExpression[callee.object.name=/Service$/][callee.property.name=/[lL]ist$/][arguments.length=0]"(
            node
          ) {
            context.report({
              node,
              messageId: "unparameterised",
              // Deliberately NOT interpolating a suggested drain name here.
              // `${name}All` reads plausibly and is wrong for most services:
              // only borrower/loan/repayment `listAll` and share-capital's
              // `ledgerListAll`/`pledgeListAll` exist, so naming e.g.
              // `roleService.listAll()` would send the reader to write a
              // runtime TypeError. Name the pattern, not an identifier.
              data: {
                call: `${node.callee.object.name}.${node.callee.property.name}`,
              },
            });
          },
        };
      },
    },
  },
};

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
    plugins: { pagination: listCalls },
    rules: {
      // Advisory perf rule (react.dev "you might not need an effect"). The app
      // consistently kicks off fetches with a synchronous setLoading(true) at the
      // top of an effect across ~9 call sites; treat as a warning rather than a
      // build-breaker so lint-in-CI can gate real errors without a mass refactor.
      "react-hooks/set-state-in-effect": "warn",

      // A page asked for is not a page received. See the plugin above.
      "pagination/no-oversized-per-page": "error",
      "pagination/no-unparameterised-list": "warn",

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
  {
    // A test asserting that an oversized page IS clamped has to be able to write
    // an oversized page. `paginate.test.ts` and `report-builders.test.ts` both
    // do exactly that, and they are the reason the rule can be trusted.
    files: ["**/*.test.ts", "**/*.test.tsx"],
    rules: { "pagination/no-oversized-per-page": "off" },
  },
]);

export default eslintConfig;
