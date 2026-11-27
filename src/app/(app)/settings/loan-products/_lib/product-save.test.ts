import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { productSaveRefusal } from "./product-save";

function httpError(status: number, data: unknown) {
  return { isAxiosError: true, response: { status, data } };
}

test("a save the server took is no refusal, so the dialog may close", async () => {
  assert.equal(await productSaveRefusal(() => Promise.resolve({ id: 4 }), "fallback"), null);
});

test("a 422 answers the server's own message, so the dialog shows it, and its field errors, so it opens their step", async () => {
  const err = httpError(422, {
    message: "The given data was invalid.",
    errors: { term: ["The default term must be between the minimum and maximum term."] },
  });
  assert.deepEqual(await productSaveRefusal(() => Promise.reject(err), "fallback"), {
    message: "The default term must be between the minimum and maximum term.",
    errors: { term: ["The default term must be between the minimum and maximum term."] },
  });
});

test("a failure with no server answer reads the caller's fallback", async () => {
  assert.deepEqual(
    await productSaveRefusal(() => Promise.reject(new Error("boom")), "We couldn't create this loan product."),
    { message: "We couldn't create this loan product.", errors: null },
  );
});

test("the dialog closes only once the save succeeded, and keeps the entries otherwise", () => {
  const page = readFileSync(resolve(process.cwd(), "src/app/(app)/settings/loan-products/page.tsx"), "utf8");
  assert.match(page, /onSubmit: \(form: ProductForm\) => Promise<ProductSaveRefusal \| null>/);
  assert.match(page, /const refusal = await onSubmit\(form\);/);
  assert.match(page, /if \(refusal !== null\) \{\s*setSaveError\(refusal\.message\);\s*if \(refusal\.errors\) stepperRef\.current\?\.showErrors\(refusal\.errors\);\s*return;\s*\}/);
  assert.match(page, /role="alert"[^>]*>\s*\{saveError\}/);
});
