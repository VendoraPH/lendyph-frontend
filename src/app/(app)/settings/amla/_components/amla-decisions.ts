import { amlaApi } from "@/lib/amla/api";
import type { AmlaChangeRequest } from "@/types/amla";
import type { AmlaNoteAction } from "./amla-note-dialog";

export type AmlaDecision = "approve" | "reject" | "withdraw";

/** The note dialog for a decision on a change request: reject needs a note, approve and withdraw take one optionally. */
export function amlaDecisionAction(request: AmlaChangeRequest, decision: AmlaDecision): AmlaNoteAction {
  switch (decision) {
    case "approve":
      return {
        title: "Approve this change?",
        description: `${request.summary}. It applies as soon as you approve it.`,
        label: "Note",
        required: false,
        confirmLabel: "Approve",
        success: "Change approved and in force",
        failure: "The change couldn't be approved.",
        run: (text) => amlaApi.approve(request.id, text),
      };
    case "reject":
      return {
        title: "Reject this change?",
        description: `${request.summary}. Say why, so the person who asked can ask again.`,
        label: "Note",
        required: true,
        confirmLabel: "Reject",
        destructive: true,
        success: "Change rejected",
        failure: "The change couldn't be rejected.",
        run: (text) => amlaApi.reject(request.id, text),
      };
    case "withdraw":
      return {
        title: "Withdraw your change?",
        description: `${request.summary}. Nothing is applied.`,
        label: "Note",
        required: false,
        confirmLabel: "Withdraw",
        destructive: true,
        success: "Change withdrawn",
        failure: "The change couldn't be withdrawn.",
        run: (text) => amlaApi.withdraw(request.id, text),
      };
  }
}
