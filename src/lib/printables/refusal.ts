import { getErrorMessage, httpStatusOf } from "@/lib/api-error";

/**
 * The server refused to give this record's document (a 422: a disclosure for a
 * loan that's still for approval, say). That isn't the API being unreachable,
 * so no blank form opens: the message, in the server's words, says why.
 *
 * Kept apart from the catalog so a screen that loads the catalog on click can
 * still recognise the refusal without bundling it.
 */
export class PrintableRefusedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PrintableRefusedError";
  }
}

/** A read's failure as the catalog's builders take it: a 422 is thrown on as a refusal, anything else is null (the blank form). */
export function refusedOrNull(err: unknown): null {
  if (httpStatusOf(err) === 422) {
    throw new PrintableRefusedError(
      getErrorMessage(err, "This document can't be printed for this record yet."),
    );
  }
  return null;
}
