// A loan product save, as the dialog needs it: null when the server took it
// (the dialog closes), or the server's own message when it refused (a 422
// names the field), so the dialog stays open on what the user typed. A 422's
// field errors come with it, so the dialog opens the step holding them.

import { getErrorMessage } from "@/lib/api-error";
import { validationErrors } from "@/lib/credit-scoring/field-errors";

export interface ProductSaveRefusal {
  message: string;
  /** The 422's field errors, or null for any other failure. */
  errors: Record<string, string[]> | null;
}

export async function productSaveRefusal(
  save: () => Promise<unknown>,
  fallback: string,
): Promise<ProductSaveRefusal | null> {
  try {
    await save();
    return null;
  } catch (err) {
    return { message: getErrorMessage(err, fallback), errors: validationErrors(err) };
  }
}
