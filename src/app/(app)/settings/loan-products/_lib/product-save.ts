// A loan product save, as the dialog needs it: null when the server took it
// (the dialog closes), or the server's own message when it refused (a 422
// names the field), so the dialog stays open on what the user typed.

import { getErrorMessage } from "@/lib/api-error";

export async function productSaveRefusal(
  save: () => Promise<unknown>,
  fallback: string,
): Promise<string | null> {
  try {
    await save();
    return null;
  } catch (err) {
    return getErrorMessage(err, fallback);
  }
}
