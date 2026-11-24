import { useState } from "react";
import {
  duplicateConfirmationText,
  needsDuplicateConfirmation,
  type PossibleDuplicate,
} from "../_lib/possible-duplicate";

interface Question {
  text: string;
  proceed: () => void;
}

/**
 * The reviewer's confirmation before approving a registration the server
 * linked to a possible duplicate (finish run round 2, decision 3): the server
 * refuses the approval without it.
 */
export function useDuplicateConfirmation(duplicate: PossibleDuplicate | null | undefined) {
  const [question, setQuestion] = useState<Question | null>(null);

  return {
    /** The open question, or null while closed. */
    text: question?.text ?? null,
    /**
     * Runs `proceed(false)` when the registration has no possible duplicate;
     * otherwise asks first, and runs `proceed(true)` once confirmed.
     */
    guard(proceed: (acknowledged: boolean) => void) {
      if (!needsDuplicateConfirmation({ possible_duplicate: duplicate })) {
        proceed(false);
        return;
      }
      setQuestion({ text: duplicateConfirmationText(duplicate), proceed: () => proceed(true) });
    },
    /** Asks in the server's words, after it refused an approval for want of the confirmation. */
    askAfterRefusal(refusal: string, proceed: () => void) {
      setQuestion({ text: duplicateConfirmationText(duplicate, refusal), proceed });
    },
    confirm() {
      const asked = question;
      setQuestion(null);
      asked?.proceed();
    },
    cancel() {
      setQuestion(null);
    },
  };
}
